from pymilvus import Collection, CollectionSchema, FieldSchema, DataType, connections, utility
import numpy as np
from tqdm import tqdm
import os
from typing import List
import json
import httpx
import asyncio

# Embedding endpoint configuration
EMBEDDING_API_BASE_URL = os.getenv("EMBEDDING_API_URL", "http://localhost:6011")
EMBEDDING_ENDPOINT = f"{EMBEDDING_API_BASE_URL}/api/embeddings"


class MilvusRAGDB:
    def __init__(self, host: str = "localhost", port: str = "19530", collection_name: str = "rag_collection"):
        self.host = host
        self.port = port
        self.collection_name = collection_name
        connections.connect("default", host=self.host, port=self.port)
        self.collection = None
        self._initialize_collection()

    async def get_embedding_from_api(self, text: str) -> List[float]:
        """
        Get embedding from the FastAPI embedding endpoint.
        
        Args:
            text: The text to generate embeddings for
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            Exception if the API call fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EMBEDDING_ENDPOINT,
                    json={"text": text, "model": "bge-m3"},
                    timeout=30.0
                )
                response.raise_for_status()
                
                data = response.json()
                if data.get("success"):
                    return data.get("embedding")
                else:
                    raise Exception(f"API Error: {data.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"❌ Error fetching embedding from API: {e}")
            raise

    async def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Get embeddings for multiple texts in parallel.
        
        Args:
            texts: List of texts to generate embeddings for
            
        Returns:
            List of embedding vectors
        """
        tasks = [self.get_embedding_from_api(text) for text in texts]
        embeddings = await asyncio.gather(*tasks)
        # Filter out any potential None results from failed API calls
        return [emb for emb in embeddings if emb is not None]

    def _initialize_collection(self):
        if not utility.has_collection(self.collection_name):
            print(f"Collection '{self.collection_name}' not found. Creating a new one.")
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                # Using 1024 for bge-m3 model
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1024),
                FieldSchema(name="metadata", dtype=DataType.VARCHAR, max_length=65535)
            ]
            schema = CollectionSchema(fields, description="RAG Database Collection")
            self.collection = Collection(name=self.collection_name, schema=schema)
            
            # Using HNSW index with COSINE metric
            index_params = {
                "metric_type": "COSINE",
                "index_type": "HNSW",
                "params": {"M": 16, "efConstruction": 256}
            }
            self.collection.create_index(field_name="embedding", index_params=index_params)
            print("✅ Collection and HNSW index created successfully.")
        else:
            print(f"✅ Found existing collection '{self.collection_name}'.")
            self.collection = Collection(name=self.collection_name)
        
        # Load collection into memory for searching
        self.collection.load()
        print("✅ Collection loaded into memory.")


    async def build(self, folder_path: str, batch_size: int = 32):
        """
        Builds the database by reading all .txt files from a folder,
        generating embeddings, and inserting them into the collection.
        
        Args:
            folder_path: The path to the folder containing .txt files.
            batch_size: The number of files to process in each batch.
        """
        if not os.path.isdir(folder_path):
            print(f"❌ Error: Folder not found at '{folder_path}'")
            return
            
        filepaths = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith(".txt")]
        
        if not filepaths:
            print(f"🤷 No .txt files found in '{folder_path}'.")
            return

        print(f"📚 Found {len(filepaths)} .txt files to process in '{folder_path}'.")
        
        for i in tqdm(range(0, len(filepaths), batch_size), desc="Building database"):
            batch_paths = filepaths[i:i + batch_size]
            batch_texts = []
            batch_metadatas = []
            
            for path in batch_paths:
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if content.strip(): # Ensure file is not empty
                            batch_texts.append(content)
                            batch_metadatas.append({
                                "source": os.path.basename(path),
                                "text": content
                            })
                except Exception as e:
                    print(f"⚠️ Could not read or process file {path}: {e}")
            
            if batch_texts:
                try:
                    await asyncio.wait_for(
                        self.insert_with_texts(batch_texts, batch_metadatas, flush=False),
                        timeout=300  # 5 minute timeout per batch
                    )
                except asyncio.TimeoutError:
                    print(f"❌ Timeout while processing batch {i//batch_size + 1}. Skipping...")
                except Exception as e:
                    print(f"❌ Error processing batch {i//batch_size + 1}: {e}")
                    raise
        
        # Flush once after all inserts are complete
        print("\n💾 Flushing all data to disk...")
        try:
            self.collection.flush()
            print("✅ All data flushed to disk successfully.")
        except Exception as e:
            print(f"❌ Error during final flush: {e}")
            raise
        
        print("✅ Database build process complete.")


    async def insert_with_texts(self, texts: List[str], metadatas: List[dict], flush: bool = True):
        """
        Insert documents with texts that will be embedded using the API endpoint.
        
        Args:
            texts: List of text strings to embed
            metadatas: List of metadata dictionaries
            flush: Whether to flush to disk immediately (default: True)
        """
        print(f"📨 Fetching embeddings for {len(texts)} documents...")
        try:
            embeddings = await asyncio.wait_for(
                self.get_embeddings_batch(texts),
                timeout=120  # 2 minute timeout for embeddings
            )
        except asyncio.TimeoutError:
            print(f"❌ Timeout fetching embeddings. Skipping this batch.")
            return
        
        if not embeddings:
            print("❌ No embeddings were generated. Skipping insertion.")
            return

        print(f"✅ Received {len(embeddings)} embeddings")
        
        await self.insert(embeddings, metadatas, flush=flush)

    async def insert(self, embeddings: List[List[float]], metadatas: List[dict], flush: bool = True):
        """
        Insert embeddings and metadata into the collection.
        
        Args:
            embeddings: List of embedding vectors (List[float])
            metadatas: List of metadata dictionaries
            flush: Whether to flush to disk immediately (default: True)
        """
        if len(embeddings) != len(metadatas):
            raise ValueError("Number of embeddings must match number of metadatas")
        
        metadata_strs = [json.dumps(metadata) for metadata in metadatas]
        
        entities = [
            embeddings, # Pymilvus 2.x accepts list of lists directly
            metadata_strs
        ]
        
        try:
            print(f"📝 Inserting {len(embeddings)} documents into Milvus...")
            # Run blocking operations in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self.collection.insert, entities)
            print(f"✅ Insert completed for {len(embeddings)} documents")
            
            if flush:
                print(f"💾 Flushing data to disk...")
                await loop.run_in_executor(None, self.collection.flush)
                print(f"✅ Inserted and flushed {len(embeddings)} documents into Milvus.")
        except Exception as e:
            print(f"❌ Error during insert/flush: {e}")
            raise

    async def search(self, query_text: str, top_k: int = 5) -> List[dict]:
        """
        Search for similar documents using a query text.
        
        Args:
            query_text: The query text to search for
            top_k: Number of top results to return
            
        Returns:
            List of results with id, distance, and metadata
        """
        print(f"🔍 Generating embedding for query: '{query_text[:50]}...'")
        query_embedding = await self.get_embedding_from_api(query_text)
        
        if not query_embedding:
            print("❌ Failed to generate query embedding. Cannot perform search.")
            return []
            
        print(f"✅ Generated query embedding. Searching...")
        
        # Search parameters for HNSW
        search_params = {"metric_type": "COSINE", "params": {"ef": 128}}
        
        try:
            loop = asyncio.get_event_loop()
            results = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: self.collection.search(
                    [query_embedding],
                    "embedding", 
                    search_params, 
                    limit=top_k, 
                    output_fields=["metadata"]
                )),
                timeout=30  # 30 second timeout for search
            )
        except asyncio.TimeoutError:
            print(f"❌ Search operation timed out.")
            return []
        except Exception as e:
            print(f"❌ Error during search: {e}")
            return []
        
        hit_list = []
        if results and len(results) > 0:
            for hit in results[0]:
                metadata = json.loads(hit.entity.get("metadata"))
                hit_list.append({
                    "id": hit.id, 
                    "distance": hit.distance, # For COSINE, lower is better (more similar)
                    "metadata": metadata
                })
        
        print(f"✅ Found {len(hit_list)} similar documents.")
        return hit_list
    
    async def search_with_embeddings(self, query_embeddings: List[List[float]], top_k: int = 5) -> List[List[dict]]:
        """
        Search using pre-computed embeddings.
        
        Args:
            query_embeddings: List of embedding vectors
            top_k: Number of top results to return
            
        Returns:
            List of results for each query
        """
        search_params = {"metric_type": "COSINE", "params": {"ef": 128}}
        
        try:
            loop = asyncio.get_event_loop()
            results = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: self.collection.search(
                    query_embeddings, 
                    "embedding", 
                    search_params, 
                    limit=top_k, 
                    output_fields=["metadata"]
                )),
                timeout=30  # 30 second timeout for search
            )
        except asyncio.TimeoutError:
            print(f"❌ Search operation timed out.")
            return []
        except Exception as e:
            print(f"❌ Error during search: {e}")
            return []
        
        all_results = []
        for hits in results:
            hit_list = []
            for hit in hits:
                metadata = json.loads(hit.entity.get("metadata"))
                hit_list.append({"id": hit.id, "distance": hit.distance, "metadata": metadata})
            all_results.append(hit_list)
        return all_results
    
    def delete_collection(self):
        """Drops the entire collection from Milvus."""
        if utility.has_collection(self.collection_name):
            self.collection.drop()
            print(f"🗑️ Collection '{self.collection_name}' has been deleted.")

# Example Usage:
async def main():
    # 1. Initialize the database client
    db = MilvusRAGDB(collection_name="scam_check_db", host = "localhost", port=6030)
    
    # Optional: Clean up previous collection
    db.delete_collection()
    db = MilvusRAGDB(collection_name="scam_check_db", host = "localhost", port=6030) # Re-initialize after deletion
    # 3. Build the database from the 'data' folder
    await db.build(folder_path="Data_Luadao")

    # 4. Perform a search
    query = "What is a vector database?"
    search_results = await db.search(query, top_k=2)
    
    print("\n--- Search Results ---")
    for result in search_results:
        print(f"ID: {result['id']}, Distance: {result['distance']:.4f}")
        print(f"Source: {result['metadata']['source']}")
        print(f"Text: {result['metadata']['text'][:100]}...\n")

if __name__ == "__main__":
    # Ensure you have the embedding service and Milvus running before executing this.
    asyncio.run(main())