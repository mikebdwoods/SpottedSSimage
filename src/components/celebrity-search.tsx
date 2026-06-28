"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface Celebrity {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface Props {
  celebrities: Celebrity[];
}

export function CelebritySearch({ celebrities }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? celebrities.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search celebrities..."
          className="w-full pl-9 pr-8 py-2.5 rounded-full border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/20 transition-shadow"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border rounded-xl shadow-lg overflow-hidden z-30">
          {results.slice(0, 6).map((celeb) => (
            <Link
              key={celeb.id}
              href={`/celebrity/${celeb.slug}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => { setOpen(false); setQuery(""); }}
            >
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {celeb.image_url ? (
                  <Image
                    src={celeb.image_url}
                    alt={celeb.name}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                    {celeb.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium">{celeb.name}</span>
            </Link>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border rounded-xl shadow-lg px-4 py-3 text-sm text-muted-foreground z-30">
          No celebrities found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
