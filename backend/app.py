import os
import time
import uuid
import json
import threading
from flask import Flask, request, jsonify, send_from_directory, render_template
from werkzeug.utils import secure_filename
from video_processor import process_video_with_script
from flask_cors import CORS
from dotenv import load_dotenv
import math

# For PDF processing
try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    print("WARNING: PyPDF2 not installed. PDF script support will be disabled.")
    PDF_SUPPORT = False

# For DOCX processing
try:
    import docx
    DOCX_SUPPORT = True
except ImportError:
    print("WARNING: python-docx not installed. DOCX script support will be disabled.")
    DOCX_SUPPORT = False

# Load environment variables from .env file
load_dotenv()

# Determine base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
# Enable CORS for all domains on all routes (for development)
CORS(app)

app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['PROCESSED_FOLDER'] = os.path.join(BASE_DIR, 'processed')
app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'mov', 'avi', 'mkv'}
app.config['ALLOWED_SCRIPT_EXTENSIONS'] = {'txt', 'md'}

# Add support for PDF and DOCX if libraries are available
if PDF_SUPPORT:
    app.config['ALLOWED_SCRIPT_EXTENSIONS'].add('pdf')
if DOCX_SUPPORT:
    app.config['ALLOWED_SCRIPT_EXTENSIONS'].add('docx')

app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('MAX_CONTENT_LENGTH', 500 * 1024 * 1024))  # Default: 500 MB limit
app.config['JOBS_DATA_FILE'] = os.path.join(BASE_DIR, 'jobs_data.json')
app.config['CLEANUP_INTERVAL'] = int(os.environ.get('CLEANUP_INTERVAL', 3600))  # Default: Clean up every hour

# Ensure upload and processed directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Constants for time estimation
AVG_PROCESSING_FACTOR = float(os.environ.get('AVG_PROCESSING_FACTOR', 1.5))  # Average processing time per second of video
INITIAL_PROGRESS_STEPS = 4  # Number of fixed steps in the process

# In-memory store for tracking job status
jobs = {}

# Load existing jobs data if available
def load_jobs_data():
    global jobs
    try:
        if os.path.exists(app.config['JOBS_DATA_FILE']):
            with open(app.config['JOBS_DATA_FILE'], 'r') as f:
                jobs = json.load(f)
                print(f"Loaded {len(jobs)} jobs from persistent storage")
    except Exception as e:
        print(f"Error loading jobs data: {e}")
        jobs = {}

# Save jobs data to file
def save_jobs_data():
    try:
        # Create a temporary file and write to it first
        temp_file = app.config['JOBS_DATA_FILE'] + '.tmp'
        with open(temp_file, 'w') as f:
            json.dump(jobs, f)
        
        # Then rename it to the actual file (atomic operation)
        import os
        os.replace(temp_file, app.config['JOBS_DATA_FILE'])
        print(f"Saved {len(jobs)} jobs to persistent storage")
    except Exception as e:
        print(f"Error saving jobs data: {e}")

# Initialize jobs data
load_jobs_data()

def allowed_video_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_VIDEO_EXTENSIONS']

def allowed_script_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_SCRIPT_EXTENSIONS']

# Function to extract text from PDF files
def extract_text_from_pdf(pdf_path):
    if not PDF_SUPPORT:
        return "Error: PDF support is not enabled. Install PyPDF2 to enable PDF support."
    
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return f"Error extracting text from PDF: {str(e)}"

# Function to extract text from DOCX files
def extract_text_from_docx(docx_path):
    if not DOCX_SUPPORT:
        return "Error: DOCX support is not enabled. Install python-docx to enable DOCX support."
    
    try:
        doc = docx.Document(docx_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
        return f"Error extracting text from DOCX: {str(e)}"

# Calculate estimated time to complete based on video duration
def estimate_processing_time(video_path):
    try:
        from moviepy.editor import VideoFileClip
        clip = VideoFileClip(video_path)
        duration = clip.duration
        clip.close()
        
        # Estimate based on video duration and a processing factor
        estimated_seconds = duration * AVG_PROCESSING_FACTOR
        return max(30, estimated_seconds)  # Minimum 30 seconds estimate
    except Exception as e:
        print(f"Error calculating video duration: {e}")
        return 180  # Default to 3 minutes if we can't determine

def format_time_remaining(seconds):
    """Format seconds into a human-readable time string."""
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    
    if hours > 0:
        return f"{hours}h {minutes}m"
    elif minutes > 0:
        return f"{minutes}m {seconds}s"
    else:
        return f"{seconds}s"

# Update job progress
def update_job_progress(job_id, step, total_steps=None, message=None):
    if job_id not in jobs:
        return
        
    job = jobs[job_id]
    
    # Initialize progress tracking if not already done
    if 'progress' not in job:
        job['progress'] = {
            'percent': 0,
            'current_step': 0,
            'total_steps': INITIAL_PROGRESS_STEPS,
            'message': 'Initializing...',
            'start_time': time.time()
        }
    
    # Update step information
    current_step = step
    job['progress']['current_step'] = current_step
    
    # Use provided total steps or default
    if total_steps:
        job['progress']['total_steps'] = total_steps
    
    # Calculate percentage based on steps
    if job['progress']['total_steps'] > 0:
        job['progress']['percent'] = min(95, int((current_step / job['progress']['total_steps']) * 100))
    
    # Update message if provided
    if message:
        job['progress']['message'] = message
    
    # Update time estimates
    elapsed_time = time.time() - job['progress']['start_time']
    if current_step > 0 and job['progress']['percent'] > 0:
        # Estimate remaining time based on progress so far
        estimated_total_time = (elapsed_time / job['progress']['percent']) * 100
        remaining_seconds = estimated_total_time - elapsed_time
        job['progress']['estimated_remaining_seconds'] = int(remaining_seconds)
        job['progress']['formatted_remaining_time'] = format_time_remaining(remaining_seconds)
    
    # Save jobs data for significant changes
    if step == 1 or step % 2 == 0 or message != job['progress'].get('message'):
        save_jobs_data()
    
    return job['progress']

# Function to clean up old jobs (runs in background thread)
def cleanup_old_jobs():
    while True:
        try:
            time.sleep(app.config['CLEANUP_INTERVAL'])
            current_time = time.time()
            expired_jobs = []
            
            # Find jobs older than 24 hours
            for job_id, job in list(jobs.items()):
                if current_time - job['timestamp'] > 86400:  # 24 hours
                    expired_jobs.append(job_id)
                    
                    # Clean up files
                    try:
                        if os.path.exists(job['video_path']):
                            os.remove(job['video_path'])
                            print(f"Removed input video: {job['video_path']}")
                        if job.get('output_path') and os.path.exists(job['output_path']):
                            os.remove(job['output_path'])
                            print(f"Removed output video: {job['output_path']}")
                    except Exception as e:
                        print(f"Error cleaning up files for job {job_id}: {e}")
                    
                    # Remove job from tracking
                    del jobs[job_id]
            
            if expired_jobs:
                print(f"Cleaned up {len(expired_jobs)} expired jobs")
                # Save changes to disk
                save_jobs_data()
                
        except Exception as e:
            print(f"Error in cleanup thread: {e}")

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_old_jobs)
cleanup_thread.daemon = True
cleanup_thread.start()

@app.route('/')
def index():
    # Return JSON for API info since we now use Next.js for frontend
    return jsonify({
        'name': 'Auto Video Editor API',
        'version': '1.0',
        'status': 'running',
        'frontend_url': 'http://localhost:3000'
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    # Check if both video and script files were uploaded
    if 'video' not in request.files:
        return jsonify({'error': 'No video file uploaded'}), 400
    
    video_file = request.files['video']
    
    # Check if video filename is valid
    if video_file.filename == '':
        return jsonify({'error': 'No video file selected'}), 400
    
    # Check if script was provided (either as file or text)
    script_file = request.files.get('script')
    script_text = request.form.get('script_text')
    
    if not script_file and not script_text:
        return jsonify({'error': 'No script provided (either file or text)'}), 400
    
    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    
    # Validate file types
    if video_file and not allowed_video_file(video_file.filename):
        return jsonify({'error': f'Video file format not allowed. Allowed formats: {app.config["ALLOWED_VIDEO_EXTENSIONS"]}'}), 400
    
    if script_file and not allowed_script_file(script_file.filename):
        return jsonify({'error': f'Script file format not allowed. Allowed formats: {app.config["ALLOWED_SCRIPT_EXTENSIONS"]}'}), 400
    
    # Create job directories
    job_dir = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    # Save the video file
    video_filename = secure_filename(video_file.filename)
    video_path = os.path.join(job_dir, video_filename)
    video_file.save(video_path)
    
    # Handle script (either file or text)
    script_path = None
    if script_file:
        script_filename = secure_filename(script_file.filename)
        script_path = os.path.join(job_dir, script_filename)
        script_file.save(script_path)
        
        # If it's a PDF or DOCX, extract the text
        if script_filename.lower().endswith('.pdf'):
            if PDF_SUPPORT:
                script_text = extract_text_from_pdf(script_path)
            else:
                return jsonify({'error': 'PDF support is not enabled. Install PyPDF2 to enable PDF support.'}), 400
        elif script_filename.lower().endswith('.docx'):
            if DOCX_SUPPORT:
                script_text = extract_text_from_docx(script_path)
            else:
                return jsonify({'error': 'DOCX support is not enabled. Install python-docx to enable DOCX support.'}), 400
        else:
            # For regular text files, read the content
            with open(script_path, 'r', encoding='utf-8', errors='ignore') as f:
                script_text = f.read()
    
    # Create job data structure
    jobs[job_id] = {
        'status': 'queued',
        'video_path': video_path,
        'script_path': script_path,
        'script_text': script_text,
        'created_at': time.time(),
        'output_path': None
    }
    
    # Save updated jobs data to disk
    save_jobs_data()
    
    # Estimate processing time based on video file size/duration
    estimated_seconds = estimate_processing_time(video_path)
    
    # Start processing thread
    threading.Thread(target=process_job, args=(job_id,)).start()
    
    return jsonify({
        'status': 'queued',
        'job_id': job_id,
        'message': 'Video uploaded and queued for processing',
        'estimated_seconds': estimated_seconds
    })

# Function to process a job
def process_job(job_id):
    job = jobs[job_id]
    
    try:
        # Update job status
        job['status'] = 'processing'
        save_jobs_data()
        
        # Process the video
        result = process_video_with_script(
            video_path=job['video_path'],
            script_text=job['script_text'],
            script_path=job['script_path'],
            job_id=job_id,
            update_progress_callback=update_job_progress
        )
        
        # Check the result - the new processor returns a dict with status
        if result.get('status') == 'error':
            job['status'] = 'failed'
            job['error'] = result.get('message', 'Unknown error occurred')
        else:
            job['status'] = 'completed'
            job['output_path'] = result['output_path']
            
            # Calculate the video duration before and after editing
            if 'duration' in result:
                job['duration'] = result['duration']
                # Calculate reduction percentage
                if job['duration']['original'] > 0:
                    reduction = 100 * (1 - job['duration']['processed'] / job['duration']['original'])
                    job['reduction_percentage'] = round(reduction, 1)
            
            # Store the segments information if available
            if 'segments' in result:
                job['segments'] = result['segments']
            
            # Store content analysis if available
            if 'analysis' in result:
                job['analysis'] = result['analysis']
        
        # Update job progress to 100%
        if 'progress' in job:
            job['progress']['percent'] = 100
            job['progress']['message'] = 'Processing complete!'
            job['progress']['current_step'] = job['progress']['total_steps']
        
        # Save the updated job data
        save_jobs_data()
        
    except Exception as e:
        print(f"Error processing job {job_id}: {str(e)}")
        job['status'] = 'failed'
        job['error'] = str(e)
        save_jobs_data()

@app.route('/api/status/<job_id>', methods=['GET'])
def check_status(job_id):
    if job_id not in jobs:
        return jsonify({'error': 'Job not found'}), 404
    
    job = jobs[job_id]
    response = {
        'job_id': job_id,
        'status': job['status'],
    }
    
    # Add progress information if available
    if 'progress' in job:
        response['progress'] = job['progress']
        
        # Format remaining time in a readable format if available
        remaining_seconds = job['progress'].get('estimated_remaining_seconds')
        if remaining_seconds is not None:
            if remaining_seconds > 60:
                minutes = math.floor(remaining_seconds / 60)
                seconds = remaining_seconds % 60
                response['progress']['formatted_remaining_time'] = f"{minutes}m {seconds}s"
            else:
                response['progress']['formatted_remaining_time'] = f"{remaining_seconds}s"
    
    if job['status'] == 'completed':
        response['download_url'] = f'/api/download/{job_id}'
        response['segments_count'] = job.get('segments_count', 0)
    elif job['status'] == 'failed':
        response['error'] = job.get('error', 'Unknown error')
    
    return jsonify(response)

@app.route('/api/download/<job_id>', methods=['GET'])
def download_video(job_id):
    if job_id not in jobs or jobs[job_id]['status'] != 'completed':
        return jsonify({'error': 'Processed video not available'}), 404
    
    job = jobs[job_id]
    directory = os.path.dirname(job['output_path'])
    filename = os.path.basename(job['output_path'])
    return send_from_directory(directory, filename, as_attachment=True)

# Clean up old jobs and files via an API endpoint (still available for manual triggering)
@app.route('/api/cleanup', methods=['POST'])
def cleanup_old_jobs_endpoint():
    current_time = time.time()
    expired_jobs = []
    
    # Find jobs older than 24 hours
    for job_id, job in list(jobs.items()):
        if current_time - job['timestamp'] > 86400:  # 24 hours
            expired_jobs.append(job_id)
            
            # Clean up files
            try:
                if os.path.exists(job['video_path']):
                    os.remove(job['video_path'])
                    print(f"Removed input video: {job['video_path']}")
                if job.get('output_path') and os.path.exists(job['output_path']):
                    os.remove(job['output_path'])
                    print(f"Removed output video: {job['output_path']}")
            except Exception as e:
                print(f"Error cleaning up files for job {job_id}: {e}")
            
            # Remove job from tracking
            del jobs[job_id]
    
    # Save changes to disk
    save_jobs_data()
    
    return jsonify({
        'message': f'Cleaned up {len(expired_jobs)} expired jobs',
        'expired_jobs': expired_jobs
    })

if __name__ == '__main__':
    print("====================================================")
    print("Auto Video Editor API Server")
    print("====================================================")
    print(f"Starting Flask API server on http://localhost:5000")
    print(f"API documentation available at http://localhost:5000")
    print("----------------------------------------------------")
    print("To start the Next.js frontend, run:")
    print("cd frontend && npm run dev")
    print("----------------------------------------------------")
    print("Or use the start_app.bat/start_app.sh script to start both servers")
    print("Automatic cleanup of old jobs is enabled - runs every", app.config['CLEANUP_INTERVAL'], "seconds")
    print("====================================================")
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 
