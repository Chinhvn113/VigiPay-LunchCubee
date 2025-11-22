# Sentinel AI Chat Backend

FastAPI-based backend for the Sentinel AI Chatbot using HyperClovaX API.

## Features

✨ **Modern & Fast**: Built with FastAPI for high performance  
🔄 **Async Support**: Full async/await support for non-blocking operations  
📝 **Auto-Documentation**: Automatic interactive API docs (Swagger UI)  
💾 **Session Management**: Maintains conversation context per session  
🛡️ **Type Safety**: Pydantic models for request/response validation  
🌐 **CORS Enabled**: Works seamlessly with frontend applications  
🤖 **HyperClovaX AI**: Powered by CLOVA Studio's HCX-005 model  

## Installation
### Option 2: Manual Setup

```bash
# Create virtual environment (optional)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r src/requirements.txt
```

## Running the Server

### Development Mode (with auto-reload)

```bash
uvicorn ./src/hyperclovax:app --reload --host 0.0.0.0 --port 6011
```

**Features:**
- Automatic reload on code changes
- Debug mode enabled
- Perfect for development

### Production Mode

```bash
python hyperclovax.py
```

Or with Uvicorn workers for better performance:

```bash
uvicorn hyperclovax:app --host 0.0.0.0 --port 5000 --workers 4
```

## API Endpoints

### POST `/api/chat`

Send a message and receive an AI response.

**Request:**
```json
{
  "message": "How do I transfer money?",
  "session_id": "user_session_123",
  "system_prompt": "Optional custom system prompt"
}
```

**Response:**
```json
{
  "success": true,
  "message": "To transfer money, you can...",
  "session_id": "user_session_123"
}
```

**Parameters:**
- `message` (required): User's message
- `session_id` (optional): Session identifier for conversation history. Defaults to "default"
- `system_prompt` (optional): Custom AI personality. Defaults to financial assistant prompt

### POST `/api/chat/clear`

Clear conversation history for a session.

**Request:**
```json
{
  "session_id": "user_session_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat history cleared",
  "session_id": "user_session_123"
}
```

### GET `/api/chat/history`

Retrieve conversation history for a session.

**Query Parameters:**
- `session_id`: Session ID (default: "default")

**Response:**
```json
{
  "success": true,
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help?"}
  ],
  "session_id": "user_session_123"
}
```

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "Sentinel AI Chat API"
}
```

## Configuration

### HyperClovaX API Settings

Edit `hyperclovax.py` to configure:

```python
client = OpenAI(
    api_key="your-api-key",
    base_url="https://clovastudio.stream.ntruss.com/v1/openai"
)
```

### Model Parameters (in `chat_api.py`)

```python
response = client.chat.completions.create(
    model="HCX-005",           # Model to use
    messages=messages,         # Conversation history
    top_p=0.7,                # Diversity parameter (0-1)
    temperature=0.5,          # Randomness parameter (0-2)
    max_tokens=1024           # Maximum response length
)
```

**Tuning Guide:**
- **Temperature**: Controls randomness
  - 0.0-0.3: Deterministic, focused responses
  - 0.5-0.7: Balanced responses
  - 0.8-2.0: Creative, diverse responses

- **Top_p**: Controls diversity
  - 0.3-0.5: Focused on likely tokens
  - 0.7-0.9: More diverse outputs

- **Max_tokens**: Maximum response length
  - Lower values = faster responses but may cut off
  - Higher values = complete responses but slower

## Project Structure

```
backend/src/
├── hyperclovax.py           # HyperClovaX API configuration  
├── randomforrest.py           # Machine Learning configuration  
├── rag_db.py           # RAG milvus database configuration  
├── requirements.txt         # Python dependencies  
├── setup.sh                 # Automated setup script  
└── README.md               # This file  
```

## Dependencies

- **fastapi**: Modern web framework
- **uvicorn**: ASGI server
- **python-multipart**: Multipart form data support
- **openai**: OpenAI Python client
- **pydantic**: Data validation
- **slowapi**: Rate limiting (optional)

## Troubleshooting

### Import Errors

**Error**: `No module named 'fastapi'`

**Solution**: Make sure dependencies are installed:
```bash
pip install -r requirements.txt
```

### Port Already in Use

**Error**: `Address already in use: ('0.0.0.0', 6011)`

**Solution**: Use a different port:
```bash
uvicorn chat_api:app --port 8000
```

### HyperClovaX API Errors

**Error**: `API rate limit exceeded`

**Solution**: 
- Implement rate limiting on the backend
- Add request delays
- Check API quota

**Error**: `Invalid API key`

**Solution**: 
- Verify API key in `hyperclovax.py`
- Check API key hasn't expired
- Regenerate if necessary

### Slow Responses

**Causes & Solutions:**
- Network latency: Check internet connection
- Large conversation history: Clear old sessions
- API overload: Use rate limiting, add workers
- Slow AI model: Adjust `max_tokens` or `temperature`

## Advanced Usage

### Rate Limiting

Prevent abuse with rate limiting:

```bash
pip install slowapi
```

Then in `chat_api.py`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/chat")
@limiter.limit("5/minute")
async def chat(chat_request: ChatRequest):
    ...
```

### Database Persistence

For production, store sessions in a database:

```bash
pip install sqlalchemy aiosqlite
```

Example with SQLAlchemy:

```python
from sqlalchemy import create_engine, Column, String, JSON
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///./chat_history.db')
Session = sessionmaker(bind=engine)

# Store/retrieve conversations from database
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["uvicorn", "chat_api:app", "--host", "0.0.0.0", "--port", "5000"]
```

Build and run:

```bash
docker build -t sentinel-chat-api .
docker run -p 5000:5000 sentinel-chat-api
```

## Performance Tips

1. **Use multiple workers**: `uvicorn chat_api:app --workers 4`
2. **Enable caching**: Cache frequently asked questions
3. **Optimize prompts**: Shorter system prompts are faster
4. **Batch requests**: Group multiple messages
5. **Use async**: Leverage async/await for I/O operations

## Security Best Practices

1. ✅ Store API keys in environment variables, not in code
2. ✅ Use HTTPS in production
3. ✅ Implement authentication/authorization
4. ✅ Add rate limiting
5. ✅ Validate all user inputs
6. ✅ Log security events
7. ✅ Keep dependencies updated

## Environment Variables

Create `.env` file:

```bash
# Optional: Override default API URL
HYPERCLOVAX_API_KEY=your-api-key-here
HYPERCLOVAX_API_URL=https://clovastudio.stream.ntruss.com/v1/openai

# Server settings
HOST=0.0.0.0
PORT=5000
```

Load with:

```python
from dotenv import load_dotenv
load_dotenv()
```

## License

Built for VigiPay an AI assisted banking application.


