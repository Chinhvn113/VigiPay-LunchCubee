# Vigipay

FastAPI-based backend using HyperClovaX API.
---
## Features

✨ **Modern & Fast**: Built with FastAPI for high performance  
🔄 **Async Support**: Full async/await support for non-blocking operations  
📝 **Auto-Documentation**: Automatic interactive API docs (Swagger UI)  
💾 **Session Management**: Maintains conversation context per session  
🛡️ **Type Safety**: Pydantic models for request/response validation  
🌐 **CORS Enabled**: Works seamlessly with frontend applications  
🤖 **HyperClovaX AI**: Powered by CLOVA Studio's HCX-005 model  

---
## 🏗️ Project Structure

```
.
├── backend/
│   ├── src/main.py             # FastAPI application, all endpoints
│   ├── src/rag_db.py           # Milvus RAG database logic
│   ├── src/randomforrest.py    # ML model loading/prediction logic
│   └── requirements.txt        # Python dependencies
├── docker/
│   └── docker-compose.yml      # Docker Compose for Milvus
├── frontend/                   # React frontend application
└── prompts/                    # Prompts for the LLM
```

---
## 🚀 Getting Started

### 1. Host Milvus Database
Ensure Docker is running on your machine.

```bash
cd docker
docker compose up -d
```

### 2. Build the RAG Knowledge Base
This script embeds documents and inserts them into the Milvus collection.

```bash
cd backend/src/
# (Optional) Add your own text files to the ../data directory
python rag_db.py
```

### 3. Configure and Run the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r src/requirements.txt

# Create a .env file from the example
cp .env.example .env
```
Now, open `backend/.env` and fill in your API keys for Naver Cloud services and other configurations.

Finally, run the server from the `backend/src` directory:
```bash
# From inside the backend/src directory
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
The API will be available at `http://localhost:8000/docs` for interactive documentation.

### 4. Configure and Run the Frontend
Follow the setup instructions in the `frontend/README.md` file.

---

## 📖 API Endpoints

All endpoints are prefixed with `/api`.

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint             | Description                                          | Auth Required |
| :----- | :------------------- | :--------------------------------------------------- | :------------ |
| `POST` | `/register`          | Register a new user and create a default bank account. | No            |
| `POST` | `/login`             | Log in a user and return JWT access/refresh tokens.    | No            |
| `POST` | `/logout`            | Log out the current user (revokes tokens).           | Yes           |
| `POST` | `/refresh`           | Obtain a new access token using a refresh token.     | No            |
| `GET`  | `/me`                | Get the profile of the currently authenticated user.   | Yes           |
| `GET`  | `/health`            | Health check for the authentication service.         | No            |

### Banking & Finance Endpoints (`/api`)

| Method | Endpoint                           | Description                                                           | Auth Required |
| :----- | :--------------------------------- | :-------------------------------------------------------------------- | :------------ |
| `GET`    | `/accounts`                        | Get all bank accounts for the current user.                           | Yes           |
| `POST`   | `/accounts`                        | Create a new bank account for the current user.                       | Yes           |
| `GET`    | `/accounts/{account_id}`           | Get details of a specific bank account.                               | Yes           |
| `GET`    | `/bank-accounts/lookup/{acc_num}`  | Publicly look up an account holder's name by account number.          | No            |
| `POST`   | `/transfers`                       | Create an external transfer transaction (simulated).                  | Yes           |
| `POST`   | `/transfer/internal`               | Execute an internal transfer between two Sentinel Bank accounts.      | Yes           |
| `GET`    | `/transfers`                       | Get the transfer history for the current user.                        | Yes           |
| `GET`    | `/transfers/{transfer_id}`         | Get details of a specific transfer.                                   | Yes           |
| `GET`    | `/transactions`                    | Get the general transaction history (income/expense) for the user.  | Yes           |
| `GET`    | `/recent-recipients`               | Get a list of recently paid recipients for quick transfers.           | Yes           |

### Savings Goals Endpoints (`/api/savings-goals`)

| Method   | Endpoint                | Description                                        | Auth Required |
| :------- | :---------------------- | :------------------------------------------------- | :------------ |
| `GET`    | `/`                     | Get all savings goals for the current user.        | Yes           |
| `POST`   | `/`                     | Create a new savings goal.                         | Yes           |
| `GET`    | `/{goal_id}`            | Get details of a specific savings goal.            | Yes           |
| `PUT`    | `/{goal_id}`            | Update a savings goal.                             | Yes           |
| `DELETE` | `/{goal_id}`            | Delete a savings goal.                             | Yes           |
| `GET`    | `/summary/{account_id}` | Get a financial summary for a specific bank account. | Yes           |


### AI & ML Endpoints (`/api`)

| Method | Endpoint                     | Description                                                                          | Auth Required |
| :----- | :--------------------------- | :----------------------------------------------------------------------------------- | :------------ |
| `POST` | `/chat`                      | General-purpose chat with intent detection (scam check vs. normal chat).             | Yes           |
| `POST` | `/chat-with-rag`             | RAG-powered chat for scam detection, accepting text and images.                      | Yes           |
| `POST` | `/voice-command`             | Process audio or text to extract structured commands (NLU).                          | Yes           |
| `POST` | `/extract-transfer-details`  | Process an image or audio file to extract structured transfer details (JSON).        | Yes           |
| `POST` | `/safety-check`              | Run a transaction through the Random Forest ML model for a fraud score.              | Yes           |
| `POST` | `/unified-analyze`           | A single endpoint to intelligently process text or an image for various tasks.       | Yes           |
| `POST` | `/process-receipt`           | OCR a receipt image and save it as a structured expense transaction.                 | Yes           |
| `POST` | `/search`                    | Directly query the Milvus vector database for relevant documents.                    | No            |
| `POST` | `/embeddings`                | Generate vector embeddings for a given text string.                                  | No            |

---


## 🛠️ Configuration

### Environment Variables
Create a `.env` file in the `backend/` directory to store your credentials. Do not commit this file to version control.

```env
# Generate with `openssl rand -hex 32`
SECRET_KEY="your_jwt_secret_key"
DATABASE_URL="sqlite:///./naver_bank.db" # Or postgresql://user:pass@host/db

# Naver Cloud API Credentials
CLOVA_OCR_API_URL="..."
CLOVA_OCR_SECRET_KEY="..."
CLOVA_SPEECH_INVOKE_URL="..."
CLOVA_SPEECH_SECRET_KEY="..."

# Milvus Connection
MILVUS_HOST="localhost"
MILVUS_PORT="19530"
```

---

## 🔐 Security Best Practices

1.  ✅ **Environment Variables**: All sensitive keys (`SECRET_KEY`, API keys) are loaded from a `.env` file and are not hardcoded.
2.  ✅ **Authentication**: Endpoints are protected using JWT-based bearer token authentication.
3.  ✅ **Password Hashing**: User passwords are securely hashed using `bcrypt`.
4.  ✅ **CORS**: Cross-Origin Resource Sharing is configured to only allow requests from trusted frontend origins in a production environment.
5.  ✅ **Input Validation**: Pydantic models automatically validate incoming request data to prevent injection and malformed data attacks.

---

## 📜 License

This project is built for VigiPay, an AI-assisted banking application.


