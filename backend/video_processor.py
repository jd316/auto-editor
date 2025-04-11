import os
import json
import tempfile
import time
import re
from typing import Dict, List
from moviepy.editor import VideoFileClip, concatenate_videoclips
import google.generativeai as genai  # Import Gemini API

# Import GPU utilities for video processing
try:
    from gpu_utils import (
        detect_gpu_info,
        get_ffmpeg_gpu_args,
        calculate_safe_memory_limit,
    )

    GPU_SUPPORT = True
    # Detect GPU once at module load
    try:
        GPU_INFO = detect_gpu_info()
        if GPU_INFO.available:
            print(f"GPU acceleration enabled: {GPU_INFO}")
        else:
            print("GPU hardware not detected, using CPU processing")
    except Exception as e:
        print(f"Error detecting GPU, falling back to CPU: {e}")
        GPU_INFO = None
        
    # Ensure FFmpeg is available for GPU acceleration
    import shutil

    FFMPEG_PATH = None
    
    # Check if ffmpeg is in the PATH
    ffmpeg_in_path = shutil.which("ffmpeg")
    if ffmpeg_in_path:
        FFMPEG_PATH = ffmpeg_in_path
        print(f"Found FFmpeg in PATH: {FFMPEG_PATH}")
    else:
        # Check if ffmpeg is in the current directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        local_ffmpeg = os.path.join(current_dir, "ffmpeg.exe")
        if os.path.exists(local_ffmpeg):
            FFMPEG_PATH = local_ffmpeg
            print(f"Using bundled FFmpeg: {FFMPEG_PATH}")
        else:
            print(
                "WARNING: FFmpeg not found in PATH or current directory. GPU acceleration may not work."
            )
except ImportError as e:
    print(f"GPU utilities not available, using CPU processing: {e}")
    GPU_SUPPORT = False
    GPU_INFO = None
    FFMPEG_PATH = None

# Initialize Gemini API
try:
    print("Initializing Gemini API:")
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
    print(f"  API Key: {'<set>' if gemini_api_key else '<not set>'}")

    if gemini_api_key:
        genai.configure(api_key=gemini_api_key)
        print("Successfully initialized Gemini API")
    else:
        print("WARNING: Gemini API key not set, video processing with Gemini will not work")
except Exception as e:
    print(f"Error initializing Gemini API: {e}")

FFMPEG_TIMEOUT = 600  # Timeout for FFmpeg in seconds (10 minutes)


# Helper function to get script content from a file path
def get_script_content(script_path):
    """Extract content from a script file based on its extension."""
    if not script_path or not os.path.exists(script_path):
        return None

    file_ext = os.path.splitext(script_path)[1].lower()

    try:
        if file_ext == ".pdf":
            # PDF extraction (if PyPDF2 is available)
            import PyPDF2

            with open(script_path, "rb") as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text
        elif file_ext == ".docx":
            # DOCX extraction (if python-docx is available)
            import docx

            doc = docx.Document(script_path)
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            return text
        else:
            # Plain text files
            with open(script_path, "r", encoding="utf-8", errors="ignore") as file:
                return file.read()
    except Exception as e:
        print(f"Error reading script file {script_path}: {e}")
        return None


def concatenate_segments(segments, output_path, progress_callback=None):
    """Concatenate video segments into a final video. 
    Uses GPU acceleration if available, otherwise falls back to CPU."""
    
    # Temporary directory for segment files
    temp_dir = tempfile.mkdtemp()
    segment_files = []
    
    try:
        # Check if we can use GPU acceleration
        use_gpu = (
            GPU_SUPPORT and GPU_INFO and GPU_INFO.available and FFMPEG_PATH is not None
        )
        
        if not FFMPEG_PATH and use_gpu:
            print(
                "GPU acceleration requested but FFmpeg not found. Falling back to CPU processing."
            )
            use_gpu = False
        
        if progress_callback:
            progress_callback(5, 5, "Creating final video...")
        
        if use_gpu:
            # GPU-accelerated approach using FFmpeg directly
            
            try:
                # First, save individual segments
                for i, segment in enumerate(segments):
                    segment_path = os.path.join(temp_dir, f"segment_{i:04d}.mp4")
                    segment.write_videofile(
                        segment_path,
                        codec="libx264",
                        audio_codec="aac",
                        temp_audiofile=os.path.join(temp_dir, f"temp_audio_{i}.m4a"),
                        remove_temp=True,
                        logger=None,
                    )
                    segment_files.append(segment_path)
                
                # Create a file list for FFmpeg
                file_list_path = os.path.join(temp_dir, "file_list.txt")
                with open(file_list_path, "w") as f:
                    for segment_path in segment_files:
                        f.write(f"file '{segment_path}'\n")
                
                # Use FFmpeg with GPU acceleration to concatenate
                ffmpeg_args = get_ffmpeg_gpu_args(
                    GPU_INFO,
                    input_file=None,  # We're using the file list instead
                    output_file=output_path,
                    memory_limit=calculate_safe_memory_limit(GPU_INFO),
                )
                
                # Replace the first element with the full path to ffmpeg if we found it
                if FFMPEG_PATH:
                    ffmpeg_args[0] = FFMPEG_PATH
                
                # Find the right position to insert concat options (after hwaccel but before any other -i)
                insert_pos = 1
                for i, arg in enumerate(ffmpeg_args):
                    if arg == "-i":
                        insert_pos = i
                        break
                
                # Insert our concat filter
                concat_args = [
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    file_list_path,
                    "-c",
                    "copy",
                ]
                ffmpeg_args[insert_pos:insert_pos] = concat_args

                print(f"Running FFmpeg GPU command: {' '.join(ffmpeg_args)}")
                import subprocess

                process = subprocess.Popen(
                    ffmpeg_args,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True, 
                )

                try:
                    stdout, stderr = process.communicate(timeout=FFMPEG_TIMEOUT)
                    if process.returncode != 0:
                        print(f"FFmpeg error: {stderr}")
                        raise Exception(f"FFmpeg error: {stderr}")
                except subprocess.TimeoutExpired:
                    process.kill()
                    print(f"FFmpeg process timed out after {FFMPEG_TIMEOUT} seconds")
                    raise Exception(
                        f"FFmpeg process timed out after {FFMPEG_TIMEOUT} seconds"
                    )

            except Exception as e:
                print(f"Error using GPU acceleration: {e}")
                print("Falling back to CPU processing")
                # Fall through to CPU approach if GPU fails
                use_gpu = False

        if not use_gpu:
            # CPU approach using MoviePy
            print("Using CPU for video processing (no GPU available)")
            final_clip = concatenate_videoclips(segments)
            final_clip.write_videofile(
                output_path,
                codec="libx264",
                audio_codec="aac",
                temp_audiofile=os.path.join(temp_dir, "temp_audio.m4a"),
                remove_temp=True,
                logger=None,
            )
            final_clip.close()
        
        # Close all segment clips
        for segment in segments:
            segment.close()
        
        print(f"Final video saved to {output_path}")
        return output_path
    
    except Exception as e:
        print(f"Error concatenating segments: {e}")
        raise
    
    finally:
        # Cleanup temporary files
        import shutil

        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"Error cleaning up temp directory: {e}")


def create_final_video(video_path, segments, output_path=None, progress_callback=None):
    """Create the final edited video from the segments."""
    if not output_path:
        filename = os.path.basename(video_path)
        base_name, _ = os.path.splitext(filename)
        output_path = os.path.join("processed", f"processed_{base_name}.mp4")
    
    # Make sure the output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Creating final video with {len(segments)} segments")
    
    # Process and combine the segments
    video_segments = []
    
    video = VideoFileClip(video_path)
    for seg in segments:
        start_time = seg["start"]
        end_time = seg["end"]
        video_segments.append(video.subclip(start_time, end_time))
    
    # Use the concatenate_segments function that handles GPU acceleration
    concatenate_segments(video_segments, output_path, progress_callback)
    
    video.close()
    return output_path


def process_video_with_gemini(
    video_path: str, script_text: str, update_progress_callback=None, job_id=None
) -> Dict:
    """
    Process a video using Gemini to identify segments that match a script.

    Args:
        video_path: Path to the video file
        script_text: The script text to use for editing
        update_progress_callback: Optional callback for progress updates
        job_id: Optional job ID for tracking

    Returns:
        Dict containing the processing results
    """
    if update_progress_callback:
        update_progress_callback(job_id, 1, 5, "Starting video processing with Gemini")

    try:
        from moviepy.editor import VideoFileClip

        # Get video properties
        video = VideoFileClip(video_path)
        video_duration = video.duration
        fps = video.fps
        width, height = video.size

        print(
            f"Video properties: duration={video_duration}s, fps={fps}, resolution={width}x{height}"
        )

        if update_progress_callback:
            update_progress_callback(job_id, 2, 5, "Uploading video to Gemini")

        # Extract a unique identifier based on the video path and content
        video_basename = os.path.basename(video_path)
        display_name = f"{video_basename}-{int(time.time())}"

        # Check if the video is already uploaded
        video_file = None
        try:
            fileList = genai.list_files(page_size=100)
            video_file = next(
                (
                    f
                    for f in fileList
                    if f.display_name and video_basename in f.display_name
                ),
                None,
            )
            if video_file:
                print(f"Found previously uploaded video: {video_file.display_name}")
                print(f"File URI: {video_file.uri}")
        except Exception as e:
            print(f"Error checking for existing file: {e}")
            video_file = None

        # Upload video file if not already uploaded
        if video_file is None:
            print(f"Uploading video: {video_path}")
            video_file = genai.upload_file(
                path=video_path, display_name=display_name, resumable=True
            )
            print(f"Completed upload: {video_file.uri}")

        # Check the state of the uploaded file
        print("Waiting for video processing to complete...")
        while video_file.state.name == "PROCESSING":
            print(".", end="", flush=True)
            time.sleep(5)
            video_file = genai.get_file(video_file.name)

        if video_file.state.name == "FAILED":
            raise ValueError(f"Video processing failed: {video_file.state.name}")

        print(f"\nVideo processing complete. State: {video_file.state.name}")

        if update_progress_callback:
            update_progress_callback(job_id, 3, 5, "Analyzing video with Gemini AI")

        # Prepare the prompt for Gemini
        prompt = f"""
        You are an expert video editor AI. I have a video that needs to be edited according to a script.

        # VIDEO INFORMATION
        Duration: {video_duration} seconds
        Resolution: {width}x{height}
        FPS: {fps}

        # SCRIPT TO FOLLOW
        {script_text or "No specific script provided. Please identify the most interesting, informative, or engaging segments of this video."}

        # YOUR TASK
        1. Analyze the video I'm providing
        2. Find the parts of the video that match my script
        3. Return PRECISE timestamps for the segments to keep
        
        # IMPORTANT INSTRUCTIONS
        - Be VERY precise with timestamps
        - I need exact start and end times in seconds
        - Only include segments that clearly match the script
        - Segments should have logical start/end points
        - If uncertain, provide more context by extending segments
        - STRICT REPETITION RULE: If two segments contain similar or identical content (like someone saying the same thing twice), you MUST select only one of them - preferably the clearest, best-performed version
        - CRITICAL: Never include multiple segments where the same information is repeated, even if phrased slightly differently
        - DO NOT include both "Hello, I'm John" and "My name is John" - these express the same information
        - Choose quality over quantity: One good segment is better than multiple repetitive ones

        # RESPONSE FORMAT
        Return ONLY a valid JSON object with this structure:
        {{
            "segments_to_keep": [
                {{
                    "start_time": start_time_in_seconds,
                    "end_time": end_time_in_seconds,
                    "description": "Explanation of why this segment matches the script"
                }}
            ],
            "analysis": "Your analysis of how well the video matches the script"
        }}
        """

        # Call Gemini API with the whole video file
        print("Making LLM inference request...")
        model = genai.GenerativeModel(model_name="models/gemini-1.5-pro-latest")
        response = model.generate_content(
            [video_file, prompt], request_options={"timeout": 600}
        )

        if update_progress_callback:
            update_progress_callback(job_id, 4, 5, "Processing Gemini's analysis")

        # Parse the response to get the segments to keep
        response_text = response.text
        print(f"Response from Gemini (first 200 chars): {response_text[:200]}...")

        # Extract JSON from the response (in case there's any text before or after)
        json_match = re.search(r"({[\s\S]*})", response_text)
        if json_match:
            json_str = json_match.group(1)
            try:
                segments_data = json.loads(json_str)
                print(
                    f"Successfully parsed JSON with keys: {list(segments_data.keys())}"
                )
            except json.JSONDecodeError as e:
                print(f"JSON parse error: {e}")
                # Try to fix common JSON formatting issues
                json_str = json_str.replace(
                    "'", '"'
                )  # Replace single quotes with double quotes
                try:
                    segments_data = json.loads(json_str)
                    print("Successfully parsed JSON after fixing quotes")
                except:
                    raise ValueError(
                        f"Could not parse JSON from Gemini response: {json_str[:200]}..."
                    )
        else:
            # Fallback if no valid JSON found
            raise ValueError("Could not extract valid JSON from Gemini response")

        if update_progress_callback:
            update_progress_callback(job_id, 5, 5, "Creating edited video")

        # Process the segments to create the final edited video
        segments_to_keep = segments_data.get("segments_to_keep", [])

        # Print segments for debugging
        print(f"Identified {len(segments_to_keep)} segments to keep:")
        for i, segment in enumerate(segments_to_keep):
            print(
                f"Segment {i+1}: {segment.get('start_time', 'N/A')}-{segment.get('end_time', 'N/A')}: {segment.get('description', 'No description')}"
            )

        # Extract the video clips to keep
        clips_to_keep = []
        for segment in segments_to_keep:
            # Handle different possible key names
            start_time = segment.get("start_time", segment.get("start", 0))
            end_time = segment.get("end_time", segment.get("end", 0))

            # Convert to float if they're strings
            if isinstance(start_time, str):
                try:
                    start_time = float(start_time)
                except ValueError:
                    print(f"Warning: Invalid start_time format: {start_time}, using 0")
                    start_time = 0

            if isinstance(end_time, str):
                try:
                    end_time = float(end_time)
                except ValueError:
                    print(
                        f"Warning: Invalid end_time format: {end_time}, using video duration"
                    )
                    end_time = video_duration

            # Ensure times are within video bounds
            start_time = max(0, float(start_time))
            end_time = min(video_duration, float(end_time))

            # Make sure end time is greater than start time
            if start_time >= end_time:
                print(
                    f"Warning: Invalid segment times {start_time}-{end_time}, skipping"
                )
                continue

            # Add a small buffer if the segment is very short
            if end_time - start_time < 1.0:
                buffer = 0.5
                start_time = max(0, start_time - buffer)
                end_time = min(video_duration, end_time + buffer)
                print(f"Extended short segment to {start_time}-{end_time}")

            print(f"Extracting clip from {start_time:.2f}s to {end_time:.2f}s")
            clip = video.subclip(start_time, end_time)
            clips_to_keep.append(clip)

        # If no segments to keep, return an error
        if not clips_to_keep:
            print("No valid segments identified, using entire video")
            # Fallback to keeping the entire video
            clip = video.subclip(0, video_duration)
            clips_to_keep = [clip]

        # Concatenate the clips
        from moviepy.editor import concatenate_videoclips

        final_clip = concatenate_videoclips(clips_to_keep)

        # Generate output path
        output_filename = f"processed_{os.path.basename(video_path)}"
        output_dir = os.path.dirname(os.path.dirname(video_path))
        processed_dir = os.path.join(output_dir, "processed")
        os.makedirs(processed_dir, exist_ok=True)
        output_path = os.path.join(processed_dir, output_filename)

        # Write the final video
        print(f"Writing final video to {output_path}")
        final_clip.write_videofile(
            output_path,
            codec="libx264",
            audio_codec="aac",
            temp_audiofile="temp-audio.m4a",
            remove_temp=True,
            logger=None,
        )

        # Close all clips
        final_clip.close()
        for clip in clips_to_keep:
            clip.close()
        video.close()

        # Return success with the processing results
        return {
            "status": "success",
            "output_path": output_path,
            "segments": segments_to_keep,
            "analysis": segments_data.get("analysis", ""),
            "duration": {
                "original": video_duration,
                "processed": sum(clip.duration for clip in clips_to_keep),
            },
        }

    except Exception as e:
        print(f"Error in Gemini video processing: {e}")
        return {"status": "error", "message": str(e)}


def process_video_with_script(
    video_path,
    script_text=None,
    script_path=None,
    job_id=None,
    update_progress_callback=None,
):
    """Process a video according to a script using Gemini."""

    # Get script content from file if provided
    if script_path and not script_text:
        script_text = get_script_content(script_path)

    # Use the Gemini processing function
    return process_video_with_gemini(
        video_path=video_path,
        script_text=script_text,
        update_progress_callback=update_progress_callback,
        job_id=job_id,
    )
