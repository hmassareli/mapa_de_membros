import { useEffect, useState } from "react";
import { api } from "../lib/api";
import HouseholdCard from "./HouseholdCard";

function gerarPdfAlteracoes(reportData) {
  import("jspdf").then(({ jsPDF }) => {
    import("jspdf-autotable").then(() => {
      const editadas = reportData.filter((f) => f.endereco_editado);
      if (editadas.length === 0) {
        alert("Nenhuma família com endereço editado para exportar.");
        return;
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;

      // Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Alterações de Endereço", pageW / 2, 20, {
        align: "center",
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const dataHoje = new Date().toLocaleDateString("pt-BR");
      doc.text(
        `Gerado em: ${dataHoje}  •  Total: ${editadas.length} família(s)`,
        pageW / 2,
        28,
        { align: "center" },
      );

      // Table
      const rows = editadas.map((f) => {
        const membros = (f.membros || [])
          .map((m) => m.primeiro_nome || m.nome_completo)
          .join(", ");
        const telefones = [
          f.telefone,
          ...(f.membros || []).map((m) => m.telefone).filter(Boolean),
        ]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(", ");
        return [
          f.nome_familia,
          [f.endereco_linha1, f.endereco_linha2, f.endereco_linha3]
            .filter(Boolean)
            .join("\n"),
          telefones || "—",
          membros || "—",
        ];
      });

      doc.autoTable({
        startY: 34,
        margin: { left: margin, right: margin },
        head: [["Família", "Endereço Atualizado", "Telefone(s)", "Membros"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: "bold" },
          1: { cellWidth: 55 },
          2: { cellWidth: 35 },
          3: { cellWidth: "auto" },
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageW / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: "center" },
          );
        },
      });

      doc.save(`alteracoes_endereco_${dataHoje.replace(/\//g, "-")}.pdf`);
    });
  });
}

export default function ReportView({ familias, filters, onSelectFamily }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("nome"); // nome | status | visita

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
    <div className="report-view">
      <div className="report-toolbar">
        <h3>📋 Relatório de Famílias ({filtered.length})</h3>
        <div className="report-actions">
          {totalEditadas > 0 && (
            <button
              className="btn-export-pdf"
              onClick={() => gerarPdfAlteracoes(reportData)}
              title="Exportar endereços editados em PDF"
            >
              📄 Exportar Alterações ({totalEditadas})
            </button>
          )}
          <div className="report-sort">
            <label>Ordenar:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="nome">Nome</option>
              <option value="status">Status</option>
              <option value="visita">Última Visita</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="report-loading">Carregando relatório...</div>
      ) : filtered.length === 0 ? (
        <div className="report-empty">
          Nenhuma família encontrada com os filtros aplicados.
        </div>
      ) : (
        <div className="report-grid">
          {filtered.map((f) => (
            <HouseholdCard
              key={f.id}
              familia={f}
              onSelect={() => onSelectFamily(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
