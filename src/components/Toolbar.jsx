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
    <div className="toolbar">
      <div className="search-box" ref={dropdownRef}>
        <svg
          className="search-icon"
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
        />
        {dropdownItems && (
          <div className="search-dropdown visible">
            {matches.length > 0 && (
              <>
                <div className="search-section-label">Famílias encontradas</div>
                {matches.map((f, i) => {
                  const color = STATUS_COLORS[f.status] || "#6b7280";
                  const label = STATUS_LABELS_SHORT[f.status] || f.status;
                  return (
                    <div
                      key={f.id}
                      className={`search-item ${activeIdx === i ? "active" : ""}`}
                      onClick={() => {
                        onSelectFamily(f.id);
                        setDropdownItems(null);
                      }}
                    >
                      <div className="search-item-icon familia">👤</div>
                      <div className="search-item-info">
                        <div
                          className="search-item-title"
                          dangerouslySetInnerHTML={{
                            __html: highlightMatch(f.nome_familia, query),
                          }}
                        />
                        <div
                          className="search-item-sub"
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
                        className="search-item-badge"
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
                <div className="search-section-label">Membros encontrados</div>
                {membros.map((m, i) => (
                  <div
                    key={m.familia_id + "-" + m.nome_completo}
                    className={`search-item ${activeIdx === matches.length + i ? "active" : ""}`}
                    onClick={() => {
                      onSelectFamily(m.familia_id);
                      setDropdownItems(null);
                    }}
                  >
                    <div className="search-item-icon familia">👥</div>
                    <div className="search-item-info">
                      <div
                        className="search-item-title"
                        dangerouslySetInnerHTML={{
                          __html: highlightMatch(m.nome_completo, query),
                        }}
                      />
                      <div className="search-item-sub">
                        Família {m.nome_familia} —{" "}
                        {m.endereco_linha1 || "Sem endereço"}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div className="search-section-label">Buscar no mapa</div>
            <div
              className={`search-item ${activeIdx === matches.length + membros.length ? "active" : ""}`}
              onClick={() => {
                geocodeAndZoom(query);
                setDropdownItems(null);
              }}
            >
              <div className="search-item-icon zoom">🔍</div>
              <div className="search-item-info">
                <div className="search-item-title">
                  Ir para &quot;{query}&quot; no mapa
                </div>
                <div className="search-item-sub">
                  Buscar endereço e dar zoom
                </div>
              </div>
            </div>
            {matches.length === 0 && membros.length === 0 && (
              <div className="search-no-results">
                Nenhum resultado para &quot;{query}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      <div className="filters">
        <select
          value={filters.status}
          onChange={(e) =>
            onFiltersChange({ ...filters, status: e.target.value })
          }
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
        >
          <option value="">Interesse em Retornar</option>
          <option value="sim">✅ Sim</option>
          <option value="nao">❌ Não</option>
          <option value="talvez">🤔 Talvez</option>
          <option value="nao_contatado">🔘 Não Contatado</option>
        </select>
        <button
          className="btn btn-secondary"
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
