import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { highlightMatch, STATUS_COLORS } from "../lib/utils";

const STATUS_LABELS_SHORT = {
  ativo: "Ativo",
  inativo: "Inativo",
  nao_contatado: "Não contatado",
  mudou: "Mudou",
  desconhecido: "Desconhecido",
};

export default function Toolbar({
  filters,
  onFiltersChange,
  familias,
  onSelectFamily,
  mapRef,
}) {
  const [query, setQuery] = useState("");
  const [dropdownItems, setDropdownItems] = useState(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timeoutRef = useRef();
  const dropdownRef = useRef();

  function handleSearch(q) {
    setQuery(q);
    if (q.length < 2) {
      setDropdownItems(null);
      return;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const lower = q.toLowerCase();
      const matches = familias
        .filter((f) => {
          const nome = (f.nome_familia || "").toLowerCase();
          const end = (f.endereco_linha1 || "").toLowerCase();
          const endC = (f.endereco_completo || "").toLowerCase();
          return (
            nome.includes(lower) || end.includes(lower) || endC.includes(lower)
          );
        })
        .slice(0, 6);

      setDropdownItems({ matches, membros: [], query: q });
      setActiveIdx(-1);

      // Also search server for members
      api
        .buscarMembros(q)
        .then((membros) => {
          const famIds = new Set(matches.map((f) => f.id));
          const filtered = membros.filter((m) => !famIds.has(m.familia_id));
          if (filtered.length > 0) {
            setDropdownItems((prev) =>
              prev ? { ...prev, membros: filtered } : null,
            );
          }
        })
        .catch(() => {});
    }, 300);
  }

  function handleKeyDown(e) {
    if (!dropdownItems) return;
    const total =
      (dropdownItems.matches?.length || 0) +
      (dropdownItems.membros?.length || 0) +
      1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // handle enter based on active index
      if (activeIdx >= 0) {
        const allItems = [
          ...(dropdownItems.matches || []).map((f) => ({
            type: "familia",
            id: f.id,
          })),
          ...(dropdownItems.membros || []).map((m) => ({
            type: "familia",
            id: m.familia_id,
          })),
          { type: "geocode" },
        ];
        const item = allItems[activeIdx];
        if (item?.type === "familia") {
          onSelectFamily(item.id);
          setDropdownItems(null);
        } else if (item?.type === "geocode") {
          geocodeAndZoom(query);
          setDropdownItems(null);
        }
      }
    }
  }

  async function geocodeAndZoom(q) {
    let searchQuery = q;
    if (!/são josé|sjc|s\.? ?j\.? ?c/i.test(q)) {
      searchQuery += ", São José dos Campos, SP, Brasil";
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "MapaDeMembrosSJC/1.0" },
      });
      const data = await resp.json();
      if (data.length > 0 && mapRef.current) {
        mapRef.current.flyTo(
          [parseFloat(data[0].lat), parseFloat(data[0].lon)],
          17,
          { duration: 1 },
        );
      }
    } catch {}
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownItems(null);
      }
    }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  const { matches = [], membros = [] } = dropdownItems || {};

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-primary z-10"
      style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
      }}
    >
      <div className="relative flex-1 min-w-50" ref={dropdownRef}>
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && handleSearch(query)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar família ou endereço..."
          autoComplete="off"
          className="w-full pl-9 pr-4 py-2 border border-white/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition"
        />
        {dropdownItems && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 max-h-80 overflow-y-auto z-50">
            {matches.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  Famílias encontradas
                </div>
                {matches.map((f, i) => {
                  const color = STATUS_COLORS[f.status] || "#6b7280";
                  const label = STATUS_LABELS_SHORT[f.status] || f.status;
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition hover:bg-blue-50 ${activeIdx === i ? "bg-blue-50" : ""}`}
                      onClick={() => {
                        onSelectFamily(f.id);
                        setDropdownItems(null);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm shrink-0">
                        👤
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium text-gray-800 truncate"
                          dangerouslySetInnerHTML={{
                            __html: highlightMatch(f.nome_familia, query),
                          }}
                        />
                        <div
                          className="text-xs text-gray-400 truncate"
                          dangerouslySetInnerHTML={{
                            __html:
                              highlightMatch(
                                f.endereco_linha1 || "Sem endereço",
                                query,
                              ) + (f.latitude ? "" : " 📍?"),
                          }}
                        />
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                        style={{ background: `${color}20`, color }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
            {membros.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  Membros encontrados
                </div>
                {membros.map((m, i) => (
                  <div
                    key={m.familia_id + "-" + m.nome_completo}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition hover:bg-blue-50 ${activeIdx === matches.length + i ? "bg-blue-50" : ""}`}
                    onClick={() => {
                      onSelectFamily(m.familia_id);
                      setDropdownItems(null);
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm shrink-0">
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-medium text-gray-800 truncate"
                        dangerouslySetInnerHTML={{
                          __html: highlightMatch(m.nome_completo, query),
                        }}
                      />
                      <div className="text-xs text-gray-400 truncate">
                        Família {m.nome_familia} —{" "}
                        {m.endereco_linha1 || "Sem endereço"}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              Buscar no mapa
            </div>
            <div
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition hover:bg-blue-50 ${activeIdx === matches.length + membros.length ? "bg-blue-50" : ""}`}
              onClick={() => {
                geocodeAndZoom(query);
                setDropdownItems(null);
              }}
            >
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm shrink-0">
                🔍
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  Ir para &quot;{query}&quot; no mapa
                </div>
                <div className="text-xs text-gray-400">
                  Buscar endereço e dar zoom
                </div>
              </div>
            </div>
            {matches.length === 0 && membros.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                Nenhum resultado para &quot;{query}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filters.status}
          onChange={(e) =>
            onFiltersChange({ ...filters, status: e.target.value })
          }
          className="px-3 py-2 border border-white/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
        >
          <option value="">Todos os Status</option>
          <option value="ativo">✅ Ativo</option>
          <option value="inativo">⚠️ Inativo</option>
          <option value="nao_contatado">🔘 Não Contatado</option>
          <option value="mudou">📦 Mudou</option>
          <option value="desconhecido">❓ Desconhecido</option>
        </select>
        <select
          value={filters.aceita_visitas}
          onChange={(e) =>
            onFiltersChange({ ...filters, aceita_visitas: e.target.value })
          }
          className="px-3 py-2 border border-white/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
        >
          <option value="">Aceita Visitas</option>
          <option value="sim">✅ Sim</option>
          <option value="nao">❌ Não</option>
          <option value="nao_contatado">🔘 Não Contatado</option>
        </select>
        <select
          value={filters.interesse_retorno}
          onChange={(e) =>
            onFiltersChange({ ...filters, interesse_retorno: e.target.value })
          }
          className="px-3 py-2 border border-white/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
        >
          <option value="">Interesse em Retornar</option>
          <option value="sim">✅ Sim</option>
          <option value="nao">❌ Não</option>
          <option value="talvez">🤔 Talvez</option>
          <option value="nao_contatado">🔘 Não Contatado</option>
        </select>
        <button
          className="px-3 py-2 border border-white/20 rounded-lg text-sm text-white hover:bg-white/15 transition cursor-pointer"
          onClick={() => {
            onFiltersChange({
              status: "",
              aceita_visitas: "",
              interesse_retorno: "",
            });
            setQuery("");
          }}
        >
          Limpar Filtros
        </button>
      </div>
    </div>
  );
}
