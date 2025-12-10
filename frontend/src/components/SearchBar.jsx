import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

const getApiBase = () => 
  import.meta.env.VITE_DATA_BASE_URL?.replace('/data', '') ||  "http://localhost:5000"||  "https://mapify-it-task.onrender.com";

const SearchBar = ({ onSelectLocation, map }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const resultsRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  const API_BASE = useMemo(() => getApiBase(), []);

  const performSearch = useCallback(async (searchQuery) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(
        `${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) {
        throw new Error("Search failed");
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        console.error("Search error:", error);
        setResults([]);
      }
    } finally {
      setIsSearching(false);
      abortControllerRef.current = null;
    }
  }, [API_BASE]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
        setIsSearching(false);
      }
    }, 300); 

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  const handleSelect = useCallback((result) => {
    setQuery(result.name);
    setShowResults(false);
    if (onSelectLocation && result.coordinates) {
      const [lng, lat] = result.coordinates;
      onSelectLocation([lat, lng], result);
    }
  }, [onSelectLocation]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={resultsRef}
      style={{
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        width: "90%",
        maxWidth: "500px",
      }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search for places in Islamabad..."
          style={{
            width: "100%",
            padding: "12px 40px 12px 16px",
            fontSize: "16px",
            border: "2px solid #2563eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            outline: "none",
          }}
        />
        {isSearching && (
          <span
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#2563eb",
            }}
          >
            Searching...
          </span>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            maxHeight: "300px",
            overflowY: "auto",
            zIndex: 1001,
          }}
        >
          {results.map((result, index) => (
            <div
              key={index}
              onClick={() => handleSelect(result)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: index < results.length - 1 ? "1px solid #e5e7eb" : "none",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "white";
              }}
            >
              <div style={{ fontWeight: "600", color: "#1f2937", marginBottom: "4px" }}>
                {result.name}
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                {result.category}
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && query.trim() && !isSearching && results.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "16px",
            textAlign: "center",
            color: "#6b7280",
            zIndex: 1001,
          }}
        >
          No results found for "{query}"
        </div>
      )}
    </div>
  );
};

export default SearchBar;

