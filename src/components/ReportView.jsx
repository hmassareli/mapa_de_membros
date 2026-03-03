import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { api } from "../lib/api";
import HouseholdCard from "./HouseholdCard";
import PrintableReport from "./PrintableReport";

export default function ReportView({ familias, filters, onSelectFamily }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("nome");
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `alteracoes_endereco_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}`,
  });

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await api.relatorio();
      setReportData(data);
    } catch (err) {
      console.error("Erro ao carregar relatório:", err);
    }
    setLoading(false);
  }

  // Filter report data using same filters
  let filtered = reportData;
  if (filters.status) {
    filtered = filtered.filter((f) => f.status === filters.status);
  }
  if (filters.aceita_visitas) {
    filtered = filtered.filter(
      (f) => f.aceita_visitas === filters.aceita_visitas,
    );
  }
  if (filters.interesse_retorno) {
    filtered = filtered.filter(
      (f) => f.interesse_retorno === filters.interesse_retorno,
    );
  }

  // Sort
  if (sortBy === "status") {
    const order = {
      nao_contatado: 0,
      inativo: 1,
      ativo: 2,
      mudou: 3,
      desconhecido: 4,
    };
    filtered = [...filtered].sort(
      (a, b) => (order[a.status] || 5) - (order[b.status] || 5),
    );
  } else if (sortBy === "visita") {
    filtered = [...filtered].sort((a, b) => {
      if (!a.ultima_visita && !b.ultima_visita) return 0;
      if (!a.ultima_visita) return -1;
      if (!b.ultima_visita) return 1;
      return new Date(b.ultima_visita) - new Date(a.ultima_visita);
    });
  }

  const totalEditadas = reportData.filter((f) => f.endereco_editado).length;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-800">
          📋 Relatório de Famílias ({filtered.length})
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {totalEditadas > 0 && (
            <button
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition cursor-pointer flex items-center gap-1"
              onClick={() => handlePrint()}
              title="Imprimir/salvar PDF com endereços editados"
            >
              🖨️ Imprimir Alterações ({totalEditadas})
            </button>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <label className="text-xs text-gray-500">Ordenar:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="nome">Nome</option>
              <option value="status">Status</option>
              <option value="visita">Última Visita</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          Carregando relatório...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Nenhuma família encontrada com os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((f) => (
            <HouseholdCard
              key={f.id}
              familia={f}
              onSelect={() => onSelectFamily(f.id)}
            />
          ))}
        </div>
      )}

      <PrintableReport ref={printRef} familias={reportData} />
    </div>
  );
}
