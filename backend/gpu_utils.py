import subprocess
import os
import logging
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gpu_utils")

# Read environment variables for GPU settings
USE_GPU = os.environ.get('USE_GPU', 'true').lower() == 'true'
GPU_MEMORY_SAFETY_FACTOR = float(os.environ.get('GPU_MEMORY_SAFETY_FACTOR', '0.7'))
FORCE_GPU_TYPE = os.environ.get('FORCE_GPU_TYPE', 'auto').lower()

if FORCE_GPU_TYPE == 'none':
    USE_GPU = False

class GPUInfo:
    def __init__(self):
        self.available = False
        self.vendor = None
        self.model = None
        self.total_memory_mb = 0
        self.available_memory_mb = 0
        self.driver_version = None
        
    def __str__(self):
        if not self.available:
            return "No GPU detected"
        return f"{self.vendor} {self.model} with {self.available_memory_mb}MB/{self.total_memory_mb}MB memory available"

def detect_gpu_info():
    """Detect GPU and return information about it including available memory"""
    # If GPU use is disabled via environment variable, return early
    if not USE_GPU:
        logger.info("GPU acceleration disabled via configuration")
        return GPUInfo()
        
    gpu_info = GPUInfo()
    
    # Use forced GPU type if specified
    if FORCE_GPU_TYPE and FORCE_GPU_TYPE != 'auto':
        logger.info(f"Forcing GPU type to: {FORCE_GPU_TYPE}")
        if FORCE_GPU_TYPE == 'nvidia':
            return detect_nvidia_gpu()
        elif FORCE_GPU_TYPE == 'amd':
            return detect_amd_gpu()
        else:
            logger.warning(f"Unknown forced GPU type: {FORCE_GPU_TYPE}")
            return gpu_info
    
    # Try auto-detection
    try:
        # Try NVIDIA first
        nvidia_gpu = detect_nvidia_gpu()
        if nvidia_gpu.available:
            return nvidia_gpu
            
        # Then try AMD
        amd_gpu = detect_amd_gpu()
        if amd_gpu.available:
            return amd_gpu
            
    except Exception as e:
        logger.exception(f"Error detecting GPU: {e}")
        
    logger.info("No GPU detected")
    return gpu_info

def detect_nvidia_gpu():
    """Detect NVIDIA GPU and return information"""
    gpu_info = GPUInfo()
    
    try:
        nvidia_output = subprocess.check_output("nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader", 
                                             shell=True, stderr=subprocess.PIPE, universal_newlines=True)
        
        # Parse output
        parts = nvidia_output.strip().split(', ')
        if len(parts) >= 3:
            gpu_info.available = True
            gpu_info.vendor = "NVIDIA"
            gpu_info.model = parts[0]
            
            # Parse memory values
            total_mem_match = re.search(r'(\d+) MiB', parts[1])
            free_mem_match = re.search(r'(\d+) MiB', parts[2])
            
            if total_mem_match and free_mem_match:
                gpu_info.total_memory_mb = int(total_mem_match.group(1))
                gpu_info.available_memory_mb = int(free_mem_match.group(1))
            
            # Get driver version if available
            if len(parts) >= 4:
                gpu_info.driver_version = parts[3]
                
            logger.info(f"NVIDIA GPU detected: {gpu_info}")
            
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        logger.debug(f"No NVIDIA GPU detected: {e}")
    
    return gpu_info

def detect_amd_gpu():
    """Detect AMD GPU and return information"""
    gpu_info = GPUInfo()
    
    try:
        amd_output = subprocess.check_output("rocm-smi --showmeminfo vram", 
                                          shell=True, stderr=subprocess.PIPE, universal_newlines=True)
        
        # Parse output - more complex for AMD
        gpu_info.available = True
        gpu_info.vendor = "AMD"
        
        # Try to extract model name
        try:
            model_output = subprocess.check_output("rocm-smi --showproductname", 
                                                shell=True, stderr=subprocess.PIPE, universal_newlines=True)
            model_match = re.search(r'GPU\[\d+\]:\s+(.+)', model_output)
            if model_match:
                gpu_info.model = model_match.group(1)
        except:
            gpu_info.model = "Unknown AMD GPU"
        
        # Extract memory info
        total_match = re.search(r'vram\s+total\s+memory\s+\(MB\):\s+(\d+)', amd_output, re.IGNORECASE)
        used_match = re.search(r'vram\s+used\s+memory\s+\(MB\):\s+(\d+)', amd_output, re.IGNORECASE)
        
        if total_match and used_match:
            gpu_info.total_memory_mb = int(total_match.group(1))
            used_memory = int(used_match.group(1))
            gpu_info.available_memory_mb = gpu_info.total_memory_mb - used_memory
        
        logger.info(f"AMD GPU detected: {gpu_info}")
            
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        logger.debug(f"No AMD GPU detected: {e}")
    
    return gpu_info

def calculate_safe_memory_limit(gpu_info, safety_factor=None):
    """Calculate a safe memory limit based on available GPU memory and a safety factor"""
    if safety_factor is None:
        safety_factor = GPU_MEMORY_SAFETY_FACTOR
        
    if not gpu_info.available or gpu_info.available_memory_mb <= 0:
        return 0
    
    # Use safety factor to avoid using all available memory
    safe_limit = int(gpu_info.available_memory_mb * safety_factor)
    
    # Ensure we don't allocate less than 512MB (minimum for most operations)
    # or more than 90% of total memory (to avoid system instability)
    min_allocation = min(512, int(gpu_info.total_memory_mb * 0.3))
    max_allocation = int(gpu_info.total_memory_mb * 0.9)
    
    safe_limit = max(min_allocation, min(safe_limit, max_allocation))
    
    logger.info(f"Safe GPU memory limit calculated: {safe_limit}MB (factor: {safety_factor})")
    return safe_limit

def get_ffmpeg_gpu_args(gpu_info, input_file, output_file, memory_limit=None):
    """Generate FFmpeg arguments optimized for the detected GPU"""
    # If GPU use is disabled via environment variable, fallback to CPU
    if not USE_GPU or not gpu_info.available:
        # Fallback to CPU
        return [
            "ffmpeg", "-i", input_file,
            "-c:v", "libx264", "-preset", "medium",
            "-c:a", "aac", 
            output_file
        ]
    
    # If no memory limit provided, calculate a safe one
    if memory_limit is None:
        memory_limit = calculate_safe_memory_limit(gpu_info)
    
    if gpu_info.vendor == "NVIDIA":
        # NVIDIA GPU configuration - place hwaccel params BEFORE input
        base_args = ["ffmpeg"]
        
        # Hardware acceleration parameters
        hw_accel = ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
        base_args.extend(hw_accel)
        
        # Input file if provided
        if input_file:
            base_args.extend(["-i", input_file])
        
        # Output encoding parameters
        base_args.extend([
            "-c:v", "h264_nvenc", 
            "-preset", "p4", 
            "-tune", "hq",
            "-b:v", "5M", 
            "-maxrate", "8M", 
            "-bufsize", "10M",
            "-c:a", "aac"
        ])
        
        # Add memory limit if needed
        if memory_limit:
            base_args.extend(["-gpu_mem", str(memory_limit)])
        
        # Add output file if provided
        if output_file:
            base_args.append(output_file)
            
        return base_args
    
    elif gpu_info.vendor == "AMD":
        # AMD GPU configuration
        base_args = ["ffmpeg", "-hwaccel", "amf"]
        
        if input_file:
            base_args.extend(["-i", input_file])
        
        base_args.extend([
            "-c:v", "h264_amf", 
            "-quality", "quality", 
            "-c:a", "aac"
        ])
        
        if output_file:
            base_args.append(output_file)
        
        return base_args
    
    # Fallback to CPU
    base_args = ["ffmpeg"]
    
    if input_file:
        base_args.extend(["-i", input_file])
    
    base_args.extend([
        "-c:v", "libx264", 
        "-preset", "medium",
        "-c:a", "aac"
    ])
    
    if output_file:
        base_args.append(output_file)
    
    return base_args

if __name__ == "__main__":
    # Test the GPU detection
    gpu_info = detect_gpu_info()
    print(f"GPU detected: {gpu_info.available}")
    print(f"GPU usage enabled: {USE_GPU}")
    if gpu_info.available:
        print(f"Vendor: {gpu_info.vendor}")
        print(f"Model: {gpu_info.model}")
        print(f"Total memory: {gpu_info.total_memory_mb}MB")
        print(f"Available memory: {gpu_info.available_memory_mb}MB")
        print(f"Driver version: {gpu_info.driver_version}")
        
        # Calculate safe memory limit
        safe_limit = calculate_safe_memory_limit(gpu_info)
        print(f"Safe memory limit: {safe_limit}MB")
        
        # Get FFmpeg args
        print("\nFFmpeg command for GPU acceleration:")
        ffmpeg_args = get_ffmpeg_gpu_args(gpu_info, "input.mp4", "output.mp4")
        print(" ".join(ffmpeg_args)) 