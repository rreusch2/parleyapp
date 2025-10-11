import os
from typing import List
import requests

from googlesearch import search

from app.tool.search.base import SearchItem, WebSearchEngine


class GoogleSearchEngine(WebSearchEngine):
    def __init__(self):
        super().__init__()
        # Try to use Google Custom Search API if credentials available
        self._api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self._search_engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
        
        # Debug logging
        if self._api_key and self._search_engine_id:
            print(f"[OK] Google Custom Search API configured (key: ...{self._api_key[-8:]})")
        else:
            print(f"[WARN] Google API not configured - will use scraping fallback")
        
    def perform_search(
        self, query: str, num_results: int = 10, *args, **kwargs
    ) -> List[SearchItem]:
        """
        Google search engine with API support.
        Falls back to googlesearch library if API not configured.
        
        Returns results formatted according to SearchItem model.
        """
        # Try API first if configured
        if self._api_key and self._search_engine_id:
            try:
                print(f"[SEARCH] Using Google Custom Search API for: {query[:50]}...")
                results = self._search_with_api(query, num_results)
                print(f"[OK] Google API returned {len(results)} results")
                return results
            except Exception as e:
                print(f"[ERROR] Google API search failed: {e}")
                print(f"[WARN] Falling back to googlesearch library...")
        
        # Fall back to googlesearch library
        print(f"[SEARCH] Using googlesearch library for: {query[:50]}...")
        results = self._search_with_library(query, num_results)
        print(f"[OK] Googlesearch library returned {len(results)} results")
        return results
    
    def _search_with_api(self, query: str, num_results: int) -> List[SearchItem]:
        """Use Google Custom Search API"""
        url = "https://www.googleapis.com/customsearch/v1"
        results = []
        
        # API returns max 10 per request
        for start in range(1, min(num_results + 1, 100), 10):
            params = {
                "key": self._api_key,
                "cx": self._search_engine_id,
                "q": query,
                "start": start,
                "num": min(10, num_results - len(results))
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if "items" in data:
                for item in data["items"]:
                    results.append(
                        SearchItem(
                            title=item.get("title", ""),
                            url=item.get("link", ""),
                            description=item.get("snippet", "")
                        )
                    )
            
            if len(results) >= num_results:
                break
                
        return results[:num_results]
    
    def _search_with_library(self, query: str, num_results: int) -> List[SearchItem]:
        """Fall back to googlesearch library"""
        raw_results = search(query, num_results=num_results, advanced=True)

        results = []
        for i, item in enumerate(raw_results):
            if isinstance(item, str):
                # If it's just a URL
                results.append(
                    SearchItem(title=f"Google Result {i+1}", url=item, description="")
                )
            else:
                results.append(
                    SearchItem(
                        title=item.title, url=item.url, description=item.description
                    )
                )

        return results
