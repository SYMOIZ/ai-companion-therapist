export const aiMemoryService = {
  /**
   * INGESTION STEP 2: Generate Vector Embedding
   * Direct fallback proxy calling FastAPI server-side embedding.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text || typeof text !== 'string' || text.trim().length === 0 || text.includes('[object Object]')) {
      return null;
    }
    return null; // Vector generation is handled entirely on the backend in the unified store routing
  },

  /**
   * INGESTION STEP 3: Store in Vector DB
   * Sends memory content to FastAPI server-side store endpoint.
   */
  async storeMemory(userId: string, content: string, sourceType: 'chat_log' | 'clinical_note' | 'bio' = 'chat_log'): Promise<boolean> {
    const safeContent = typeof content === 'string' ? content : JSON.stringify(content || '');
    if (safeContent.includes("[object Object]") || safeContent.trim().length < 5) {
        return false;
    }

    try {
      const token = localStorage.getItem('sukoon_auth_token') || '';
      if (!token) return false;
      const response = await fetch('/api/engine/memory/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: safeContent,
          sourceType
        })
      });

      if (!response.ok) return false;
      const text = await response.text();
      let res;
      try {
        res = JSON.parse(text);
      } catch (e) {
        console.error("storeMemory JSON parse error:", text.substring(0, 100));
        return false;
      }
      return !!res.success;
    } catch (e) {
      console.error("Failed to store memory via REST API:", e);
      return false;
    }
  },

  /**
   * RETRIEVAL PIPELINE: Read Path
   * Fetches context vector similarity results calculated securely on the server.
   */
  async retrieveContext(userId: string, query: string): Promise<string> {
    if (!query || typeof query !== 'string') return "";

    try {
      const token = localStorage.getItem('sukoon_auth_token') || '';
      if (!token) return "";
      const response = await fetch(`/api/engine/memory/retrieve?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return "";
      const text = await response.text();
      let res;
      try {
        res = JSON.parse(text);
      } catch (err) {
        console.error("retrieveContext JSON parse error:", text.substring(0, 100));
        return "";
      }
      return res.context || "";
    } catch (e) {
      console.error("Retrieval pipeline failed via REST query:", e);
      return "";
    }
  }
};
