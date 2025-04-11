# Auto-Editor

Auto-Editor is an AI-powered video editing application that automatically processes videos based on scripts or text inputs. It leverages Google's Gemini API to intelligently edit your videos, saving you time in the editing process.

## Features

- **AI-Powered Editing**: Automatically edits videos based on script content
- **Multiple Script Formats**: Supports plain text, PDF, DOCX, and direct text input
- **GPU Acceleration**: Utilizes GPU for faster processing when available
- **Real-time Progress Tracking**: Provides detailed status updates during processing
- **Modern UI**: Responsive, user-friendly interface built with Next.js

## Project Structure

- `/frontend`: Next.js-based UI (TypeScript, React)
- `/backend`: Flask API server for video processing (Python)

## Prerequisites

### Backend

- Python 3.8+
- FFmpeg installed on your system (bundled for Windows)
- Google Gemini API key
- (Optional) A GPU with NVIDIA or AMD hardware for acceleration

### Frontend

- Node.js 18+ and npm
- Supabase account for authentication

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv .venv
   ```

3. Activate the virtual environment:
   - Windows: `.venv\Scripts\activate`
   - macOS/Linux: `source .venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Copy the example environment file and configure your variables:
   ```
   cp .env.example .env
   ```
   Then edit `.env` and add your Gemini API key.

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Copy the example environment file and configure:
   ```
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` and add your Supabase credentials.

## Running the Application

### Start the Backend

```
cd backend
python app.py
```

### Start the Frontend

```
cd frontend
npm run dev
```

Access the application at: http://localhost:3000

## Environment Variables

### Backend
- `GEMINI_API_KEY`: Your Google Gemini API key
- `PORT`: Server port (default: 5000)
- `HOST`: Server host (default: 0.0.0.0)
- `USE_GPU`: Enable GPU acceleration (default: true)

### Frontend
- `NEXT_PUBLIC_API_URL`: URL of the backend API (default: http://localhost:5000)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## License

[MIT License](LICENSE) 