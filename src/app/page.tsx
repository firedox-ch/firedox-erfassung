"use client";

import { useEffect, useState } from "react";
import { db, type Liegenschaft, type Mangel } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { exportAsZip, downloadBlob } from "@/lib/export";
import { generatePDF } from "@/lib/pdf";
import {
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Search,
  MapPin,
  Camera,
  X,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Building2,
  Download,
  FileDown,
  ArrowLeft,
  Save,
  Layers,
  ChevronDown,
} from "lucide-react";

const ORT_OPTIONS = [
  "Treppenhaus A",
  "Treppenhaus B",
  "Tiefgarage",
  "Eingangsbereich",
  "Keller",
  "Dachboden",
  "Waschküche",
  "Heizungsraum",
  "Technikraum",
  "Aufzug",
  "Flur / Korridor",
  "Wohnung",
  "Büro",
  "Lager",
  "Aussenbreich",
];

const GESCHOSS_OPTIONS = [
  "UG2",
  "UG1",
  "EG",
  "1. OG",
  "2. OG",
  "3. OG",
  "4. OG",
  "5. OG",
  "6. OG",
  "7. OG",
  "8. OG",
  "DG",
  "Dach",
];

type Tab = "dashboard" | "maengel" | "liegenschaft";

const EMPTY_FORM: Omit<Liegenschaft, "id" | "createdAt" | "updatedAt"> = {
  name: "", strasse: "", plz: "", ort: "", gebaeudeart: "",
  baujahr: "", anzahlGeschosse: "", anzahlEinheiten: "",
  eigentuemer: "", verwalter: "",
  begehungsDatum: new Date().toISOString().split("T")[0],
  pruefer: "", notizen: "",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("liegenschaft");
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMangel, setViewMangel] = useState<Mangel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNew, setEditingNew] = useState(false);

  // Live queries
  const liegenschaften = useLiveQuery(() => db.liegenschaften.toArray()) ?? [];
  const currentLiegenschaft = liegenschaften.find(l => l.id === selectedId) ?? null;
  const maengel =
    useLiveQuery(async (): Promise<Mangel[]> => {
      if (!currentLiegenschaft) return [];
      return db.maengel
        .where("liegenschaftId")
        .equals(currentLiegenschaft.id)
        .reverse()
        .sortBy("createdAt");
    }, [currentLiegenschaft?.id]) ?? [];

  const [liegenschaftForm, setLiegenschaftForm] = useState<Omit<Liegenschaft, "id" | "createdAt" | "updatedAt">>({ ...EMPTY_FORM });

  // Auto-select first Liegenschaft if none selected
  useEffect(() => {
    if (editingNew || selectedId) return;
    if (liegenschaften.length > 0) {
      setSelectedId(liegenschaften[0].id);
    }
  }, [liegenschaften, selectedId, editingNew]);

  // Load selected Liegenschaft data into form
  useEffect(() => {
    if (currentLiegenschaft && !editingNew) {
      setLiegenschaftForm({
        name: currentLiegenschaft.name,
        strasse: currentLiegenschaft.strasse,
        plz: currentLiegenschaft.plz,
        ort: currentLiegenschaft.ort,
        gebaeudeart: currentLiegenschaft.gebaeudeart,
        baujahr: currentLiegenschaft.baujahr,
        anzahlGeschosse: currentLiegenschaft.anzahlGeschosse,
        anzahlEinheiten: currentLiegenschaft.anzahlEinheiten,
        eigentuemer: currentLiegenschaft.eigentuemer,
        verwalter: currentLiegenschaft.verwalter,
        begehungsDatum: currentLiegenschaft.begehungsDatum,
        pruefer: currentLiegenschaft.pruefer,
        notizen: currentLiegenschaft.notizen,
      });
    }
  }, [currentLiegenschaft, editingNew]);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  // --- Handlers ---
  const saveLiegenschaft = async () => {
    if (!liegenschaftForm.name || !liegenschaftForm.strasse) return;
    setSaving(true);
    try {
      if (currentLiegenschaft && !editingNew) {
        await db.liegenschaften.update(currentLiegenschaft.id, {
          ...liegenschaftForm,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const newId = uuid();
        await db.liegenschaften.add({
          id: newId,
          ...liegenschaftForm,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setSelectedId(newId);
        setEditingNew(false);
        setTimeout(() => setActiveTab("dashboard"), 300);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportZip = async () => {
    if (!currentLiegenschaft) return;
    setExporting(true);
    try {
      const blob = await exportAsZip(currentLiegenschaft, maengel);
      const filename = `${currentLiegenschaft.name.replace(/\s+/g, "_")}_${currentLiegenschaft.begehungsDatum}.zip`;
      downloadBlob(blob, filename);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!currentLiegenschaft) return;
    setExporting(true);
    try {
      const blob = await generatePDF(currentLiegenschaft, maengel);
      const filename = `Brandschutzbericht_${currentLiegenschaft.name.replace(/\s+/g, "_")}_${currentLiegenschaft.begehungsDatum}.pdf`;
      downloadBlob(blob, filename);
    } finally {
      setExporting(false);
    }
  };

  const handleNewLiegenschaft = () => {
    setLiegenschaftForm({ ...EMPTY_FORM });
    setEditingNew(true);
    setSelectedId(null);
    setActiveTab("liegenschaft");
  };

  const handleSelectLiegenschaft = (id: string) => {
    setSelectedId(id);
    setEditingNew(false);
    setActiveTab("dashboard");
  };

  const handleDeleteLiegenschaft = async (id: string) => {
    if (!confirm("Liegenschaft und alle zugehörigen Mängel löschen?")) return;
    await db.maengel.where("liegenschaftId").equals(id).delete();
    await db.liegenschaften.delete(id);
    if (selectedId === id) {
      setSelectedId(null);
      setEditingNew(false);
    }
  };

  // Stats
  const openCount = maengel.filter((m) => m.status === "Offen").length;
  const criticalCount = maengel.filter((m) => m.prioritaet === "Kritisch" && m.status === "Offen").length;

  const filteredMaengel = maengel.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.titel.toLowerCase().includes(q) ||
      m.ort.toLowerCase().includes(q) ||
      m.beschreibung.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden shadow-2xl border-x border-gray-200 relative">
      {/* Header */}
      <header className="bg-white px-5 py-3 flex justify-between items-center border-b border-gray-100 shadow-sm z-20">
        <div>
          <h1 className="text-xl font-black tracking-tight text-red-600">
            Fire<span className="text-gray-800">Dox</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
            Erfassung
          </p>
        </div>
        {currentLiegenschaft && (
          <div className="flex gap-2">
            <button
              onClick={handleExportZip}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-xs hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              ZIP
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <FileDown size={14} />
              PDF
            </button>
          </div>
        )}
      </header>

      {/* FAB - fixed position, always visible */}
      {(currentLiegenschaft || (selectedId && liegenschaften.length > 0)) && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-24 right-6 z-50 bg-red-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5),0_0_40px_rgba(220,38,38,0.25)] border-[5px] border-white active:scale-90 transition-all hover:shadow-[0_0_25px_rgba(220,38,38,0.6),0_0_50px_rgba(220,38,38,0.3)]"
        >
          <Plus size={26} strokeWidth={3} />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar">
        {activeTab === "liegenschaft" && (
          <LiegenschaftTab
            form={liegenschaftForm}
            setForm={setLiegenschaftForm}
            onSave={saveLiegenschaft}
            saving={saving}
            isEditing={editingNew || !!currentLiegenschaft}
            isNew={editingNew || !currentLiegenschaft}
            onNewLiegenschaft={handleNewLiegenschaft}
            liegenschaften={liegenschaften}
            selectedId={selectedId}
            onSelect={handleSelectLiegenschaft}
            onDelete={handleDeleteLiegenschaft}
          />
        )}
        {activeTab === "dashboard" && (
          <DashboardTab
            liegenschaft={currentLiegenschaft}
            maengel={maengel}
            openCount={openCount}
            criticalCount={criticalCount}
            onViewMangel={setViewMangel}
            onGoToMaengel={() => setActiveTab("maengel")}
          />
        )}
        {activeTab === "maengel" && (
          <MaengelTab
            maengel={filteredMaengel}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onViewMangel={setViewMangel}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-100 p-2 pb-6 px-8 flex justify-between items-center relative z-20">
        <button
          onClick={() => setActiveTab("liegenschaft")}
          className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === "liegenschaft" ? "text-red-600 scale-110" : "text-gray-300"}`}
        >
          <Building2 size={22} strokeWidth={activeTab === "liegenschaft" ? 3 : 2} />
          <span className="text-[10px] font-black uppercase">Objekt</span>
        </button>

        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === "dashboard" ? "text-red-600 scale-110" : "text-gray-300"}`}
        >
          <ClipboardCheck size={22} strokeWidth={activeTab === "dashboard" ? 3 : 2} />
          <span className="text-[10px] font-black uppercase">Status</span>
        </button>

        <button
          onClick={() => setActiveTab("maengel")}
          className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === "maengel" ? "text-red-600 scale-110" : "text-gray-300"}`}
        >
          <AlertTriangle size={22} strokeWidth={activeTab === "maengel" ? 3 : 2} />
          <span className="text-[10px] font-black uppercase">Mängel</span>
        </button>
      </nav>

      {/* Add Mangel Modal */}
      {showAddModal && currentLiegenschaft && (
        <AddMangelModal
          liegenschaftId={currentLiegenschaft.id}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* View Mangel Modal */}
      {viewMangel && (
        <ViewMangelModal
          mangel={viewMangel}
          onClose={() => setViewMangel(null)}
          onUpdate={(updated) => setViewMangel(updated)}
        />
      )}
    </div>
  );
}

// --- Liegenschaft Tab ---
function LiegenschaftTab({
  form,
  setForm,
  onSave,
  saving,
  isEditing,
  isNew,
  onNewLiegenschaft,
  liegenschaften,
  selectedId,
  onSelect,
  onDelete,
}: {
  form: Omit<Liegenschaft, "id" | "createdAt" | "updatedAt">;
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  saving: boolean;
  isEditing: boolean;
  isNew: boolean;
  onNewLiegenschaft: () => void;
  liegenschaften: Liegenschaft[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 space-y-4 pb-8 animate-fade-in">
      {/* Liegenschafts-Liste */}
      {liegenschaften.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-black text-gray-800">Liegenschaften</h2>
            <button
              onClick={onNewLiegenschaft}
              className="text-xs bg-red-600 text-white font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg"
            >
              <Plus size={14} /> Neue
            </button>
          </div>
          <div className="space-y-2 mb-6">
            {liegenschaften.map((l) => (
              <div
                key={l.id}
                className={`bg-white p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98] ${
                  selectedId === l.id ? "border-red-400 shadow-md" : "border-gray-100 shadow-sm"
                }`}
              >
                <div className="flex-1 min-w-0" onClick={() => onSelect(l.id)}>
                  <p className="font-bold text-sm text-gray-800 truncate">{l.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {l.strasse}, {l.plz} {l.ort}
                    {l.begehungsDatum ? ` | ${l.begehungsDatum}` : ""}
                  </p>
                </div>
                {selectedId === l.id && (
                  <span className="text-[8px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase">Aktiv</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(l.id); }}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formular */}
      {(isEditing || liegenschaften.length === 0) && (
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800">
          {isNew ? "Neue Liegenschaft" : "Liegenschaft bearbeiten"}
        </h2>
      </div>
      )}

      {(isEditing || liegenschaften.length === 0) && (<>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Stammdaten
        </h3>

        <Field label="Objektname *" value={form.name} onChange={(v) => update("name", v)} placeholder="z.B. Mühlegasse 14" />
        <Field label="Strasse / Nr. *" value={form.strasse} onChange={(v) => update("strasse", v)} placeholder="z.B. Mühlegasse 14" />
        <div className="grid grid-cols-3 gap-3">
          <Field label="PLZ" value={form.plz} onChange={(v) => update("plz", v)} placeholder="8000" />
          <div className="col-span-2">
            <Field label="Ort" value={form.ort} onChange={(v) => update("ort", v)} placeholder="Zürich" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">
              Gebäudeart
            </label>
            <select
              value={form.gebaeudeart}
              onChange={(e) => update("gebaeudeart", e.target.value)}
              className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent"
            >
              <option value="">Auswählen...</option>
              <option value="Wohngebäude">Wohngebäude</option>
              <option value="Büro / Gewerbe">Büro / Gewerbe</option>
              <option value="Mischnutzung">Mischnutzung</option>
              <option value="Industrie">Industrie</option>
              <option value="Öffentlich">Öffentlich</option>
              <option value="Andere">Andere</option>
            </select>
          </div>
          <Field label="Baujahr" value={form.baujahr} onChange={(v) => update("baujahr", v)} placeholder="1985" type="number" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Geschosse" value={form.anzahlGeschosse} onChange={(v) => update("anzahlGeschosse", v)} placeholder="5" type="number" />
          <Field label="Einheiten" value={form.anzahlEinheiten} onChange={(v) => update("anzahlEinheiten", v)} placeholder="12" type="number" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Beteiligte
        </h3>
        <Field label="Eigentümer" value={form.eigentuemer} onChange={(v) => update("eigentuemer", v)} placeholder="Muster AG" />
        <Field label="Verwalter" value={form.verwalter} onChange={(v) => update("verwalter", v)} placeholder="Immobilia GmbH" />
        <Field label="Prüfer" value={form.pruefer} onChange={(v) => update("pruefer", v)} placeholder="Edin Zolj" />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Begehung
        </h3>
        <Field label="Datum der Begehung" value={form.begehungsDatum} onChange={(v) => update("begehungsDatum", v)} type="date" />
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">
            Notizen
          </label>
          <textarea
            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent min-h-[80px]"
            placeholder="Allgemeine Bemerkungen zur Begehung..."
            value={form.notizen}
            onChange={(e) => update("notizen", e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving || !form.name || !form.strasse}
        className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Save size={18} />
        {saving ? "Speichere..." : isNew ? "Liegenschaft Speichern" : "Aktualisieren"}
      </button>
      </>)}
    </div>
  );
}

// --- Dashboard Tab ---
function DashboardTab({
  liegenschaft,
  maengel,
  openCount,
  criticalCount,
  onViewMangel,
  onGoToMaengel,
}: {
  liegenschaft: Liegenschaft | null;
  maengel: Mangel[];
  openCount: number;
  criticalCount: number;
  onViewMangel: (m: Mangel) => void;
  onGoToMaengel: () => void;
}) {
  if (!liegenschaft) {
    return (
      <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-4 mt-20">
        <Building2 size={48} className="text-gray-300" />
        <p className="font-bold">Zuerst eine Liegenschaft erfassen</p>
        <p className="text-sm">Wechsle zum Tab &quot;Objekt&quot; und erfasse die Stammdaten.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Total</p>
          <p className="text-2xl font-black text-gray-800">{maengel.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Offen</p>
          <p className="text-2xl font-black text-red-600">{openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Kritisch</p>
          <p className="text-2xl font-black text-orange-500">{criticalCount}</p>
        </div>
      </div>

      {/* Property Card */}
      <div className="bg-gray-900 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Building2 size={100} />
        </div>
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">
          Aktuelle Liegenschaft
        </p>
        <h3 className="font-bold text-xl mb-1">{liegenschaft.name}</h3>
        <p className="text-gray-400 text-sm mb-1">
          {liegenschaft.strasse}, {liegenschaft.plz} {liegenschaft.ort}
        </p>
        {liegenschaft.gebaeudeart && (
          <p className="text-gray-500 text-xs">
            {liegenschaft.gebaeudeart}
            {liegenschaft.baujahr ? ` | Bj. ${liegenschaft.baujahr}` : ""}
            {liegenschaft.anzahlGeschosse ? ` | ${liegenschaft.anzahlGeschosse} Geschosse` : ""}
          </p>
        )}
        <p className="text-gray-500 text-xs mt-2">
          Begehung: {liegenschaft.begehungsDatum}
          {liegenschaft.pruefer ? ` | ${liegenschaft.pruefer}` : ""}
        </p>
      </div>

      {/* Recent Issues */}
      <div className="flex justify-between items-center px-1">
        <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">
          Aktuelle Mängel
        </h3>
        <button onClick={onGoToMaengel} className="text-xs text-gray-400 font-bold">
          Alle ({maengel.length})
        </button>
      </div>

      {maengel.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
          <p className="font-bold text-sm">Keine Mängel erfasst</p>
          <p className="text-xs mt-1">Tippe auf + um einen Mangel zu erfassen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {maengel.slice(0, 5).map((mangel) => (
            <MangelCard key={mangel.id} mangel={mangel} onClick={() => onViewMangel(mangel)} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Mängel Tab ---
function MaengelTab({
  maengel,
  searchQuery,
  setSearchQuery,
  onViewMangel,
}: {
  maengel: Mangel[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onViewMangel: (m: Mangel) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-gray-50 animate-fade-in">
      <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Titel, Ort oder Beschreibung..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 hide-scrollbar">
        {maengel.length === 0 ? (
          <div className="text-center text-gray-400 mt-16">
            <AlertTriangle size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-sm">Keine Mängel gefunden</p>
          </div>
        ) : (
          maengel.map((mangel) => (
            <MangelCardFull key={mangel.id} mangel={mangel} onClick={() => onViewMangel(mangel)} />
          ))
        )}
      </div>
    </div>
  );
}

// --- Mangel Card (compact) ---
function MangelCard({ mangel, onClick }: { mangel: Mangel; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm hover:border-red-200 transition-colors cursor-pointer active:scale-[0.98]"
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${
          mangel.prioritaet === "Kritisch"
            ? "bg-red-50 text-red-600"
            : mangel.prioritaet === "Hoch"
              ? "bg-orange-50 text-orange-600"
              : "bg-yellow-50 text-yellow-600"
        }`}
      >
        {mangel.fotos[0] ? (
          <img src={mangel.fotos[0]} className="w-full h-full object-cover" alt="" />
        ) : (
          <AlertTriangle size={20} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 truncate text-sm">{mangel.titel}</p>
        <p className="text-[10px] text-gray-400 flex items-center gap-1 font-bold uppercase tracking-tight">
          <MapPin size={10} /> {mangel.ort}
          {mangel.geschoss ? ` | ${mangel.geschoss}` : ""}
        </p>
      </div>
      <PrioBadge prio={mangel.prioritaet} small />
      <ChevronRight size={18} className="text-gray-300" />
    </div>
  );
}

// --- Mangel Card (full, for list) ---
function MangelCardFull({ mangel, onClick }: { mangel: Mangel; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-[0.99] ${
        mangel.status === "Erledigt" ? "opacity-60 grayscale" : ""
      }`}
    >
      {mangel.fotos[0] && (
        <img src={mangel.fotos[0]} className="w-full h-44 object-cover" alt="" />
      )}
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <PrioBadge prio={mangel.prioritaet} />
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              mangel.status === "Offen"
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-600"
            }`}
          >
            {mangel.status}
          </span>
        </div>
        <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">
          {mangel.titel}
        </h4>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed line-clamp-2">
          {mangel.beschreibung}
        </p>
        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-3 border-t border-gray-50 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1">
            <MapPin size={10} className="text-red-400" /> {mangel.ort}
          </div>
          <div className="flex items-center gap-2">
            {mangel.fotos.length > 0 && (
              <span className="flex items-center gap-1">
                <Camera size={10} /> {mangel.fotos.length}
              </span>
            )}
            <span>{new Date(mangel.createdAt).toLocaleDateString("de-CH")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Add Mangel Modal ---
function AddMangelModal({
  liegenschaftId,
  onClose,
}: {
  liegenschaftId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    titel: "",
    beschreibung: "",
    ort: "",
    geschoss: "",
    prioritaet: "Mittel" as Mangel["prioritaet"],
  });
  const [fotos, setFotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setFotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!form.titel || !form.ort) return;
    setSaving(true);
    try {
      await db.maengel.add({
        id: uuid(),
        liegenschaftId,
        titel: form.titel,
        beschreibung: form.beschreibung,
        ort: form.ort,
        geschoss: form.geschoss,
        prioritaet: form.prioritaet,
        status: "Offen",
        fotos,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end animate-fade-in backdrop-blur-sm">
      <div className="bg-white w-full max-w-md mx-auto rounded-t-[2rem] p-6 animate-slide-up max-h-[92vh] overflow-y-auto hide-scrollbar shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-black text-gray-800">Mangel erfassen</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Photo capture */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">
              Beweisfotos
            </label>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {fotos.map((foto, i) => (
                <div key={i} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                  <img src={foto} className="w-full h-full object-cover" alt="" />
                  <button
                    onClick={() => removeFoto(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-red-400 transition-colors">
                <Camera size={24} className="text-gray-300" />
                <span className="text-[8px] text-gray-400 font-bold uppercase">Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  className="hidden"
                  multiple
                />
              </label>
            </div>
          </div>

          <Field
            label="Was wurde festgestellt? *"
            value={form.titel}
            onChange={(v) => setForm((p) => ({ ...p, titel: v }))}
            placeholder="z.B. Defekte Brandschutzklappe"
          />

          <div className="grid grid-cols-2 gap-3">
            <ComboField
              label="Ort / Bereich *"
              value={form.ort}
              onChange={(v) => setForm((p) => ({ ...p, ort: v }))}
              placeholder="Auswählen oder tippen..."
              options={ORT_OPTIONS}
              icon={<MapPin size={16} className="text-gray-300" />}
            />
            <ComboField
              label="Geschoss"
              value={form.geschoss}
              onChange={(v) => setForm((p) => ({ ...p, geschoss: v }))}
              placeholder="Auswählen..."
              options={GESCHOSS_OPTIONS}
              icon={<Layers size={16} className="text-gray-300" />}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">
              Priorität
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["Gering", "Mittel", "Hoch", "Kritisch"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm((prev) => ({ ...prev, prioritaet: p }))}
                  className={`py-2.5 text-[10px] font-black rounded-xl border transition-all ${
                    form.prioritaet === p
                      ? p === "Kritisch"
                        ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-200"
                        : p === "Hoch"
                          ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200"
                          : p === "Mittel"
                            ? "bg-yellow-500 text-white border-yellow-500 shadow-lg shadow-yellow-200"
                            : "bg-green-600 text-white border-green-600 shadow-lg shadow-green-200"
                      : "bg-gray-50 text-gray-400 border-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">
              Beschreibung
            </label>
            <textarea
              className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent min-h-[80px]"
              placeholder="Details zum Mangel..."
              value={form.beschreibung}
              onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-bold text-sm">
              Abbrechen
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.titel || !form.ort}
              className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50"
            >
              {saving ? "Speichere..." : "Mangel Senden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- View Mangel Modal ---
function ViewMangelModal({
  mangel,
  onClose,
  onUpdate,
}: {
  mangel: Mangel;
  onClose: () => void;
  onUpdate: (m: Mangel) => void;
}) {
  const toggleStatus = async () => {
    const newStatus = mangel.status === "Offen" ? "Erledigt" : "Offen";
    await db.maengel.update(mangel.id, { status: newStatus, updatedAt: new Date().toISOString() });
    onUpdate({ ...mangel, status: newStatus });
  };

  const deleteMangel = async () => {
    if (!confirm("Mangel wirklich löschen?")) return;
    await db.maengel.delete(mangel.id);
    onClose();
  };

  const [fotoIndex, setFotoIndex] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end animate-fade-in backdrop-blur-sm">
      <div className="bg-white w-full max-w-md mx-auto rounded-t-[2rem] p-6 animate-slide-up max-h-[92vh] overflow-y-auto hide-scrollbar shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />

        <button onClick={onClose} className="flex items-center gap-2 text-gray-400 text-sm font-bold mb-4">
          <ArrowLeft size={18} /> Zurück
        </button>

        <h2 className="text-xl font-black text-gray-800 mb-4 leading-tight">
          {mangel.titel}
        </h2>

        {/* Photo gallery */}
        {mangel.fotos.length > 0 && (
          <div className="mb-4">
            <div className="w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden relative">
              <img src={mangel.fotos[fotoIndex]} className="w-full h-full object-cover" alt="" />
              <PrioBadge prio={mangel.prioritaet} className="absolute top-3 left-3" />
              {mangel.fotos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {mangel.fotos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFotoIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === fotoIndex ? "bg-white scale-125" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-gray-50 p-4 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest">Ort</label>
            <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
              <MapPin size={16} className="text-red-500" />
              {mangel.ort}
              {mangel.geschoss ? ` (${mangel.geschoss})` : ""}
            </div>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest">Status</label>
            <div
              className={`flex items-center gap-2 font-bold text-sm ${mangel.status === "Offen" ? "text-red-600" : "text-green-600"}`}
            >
              {mangel.status === "Offen" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              {mangel.status}
            </div>
          </div>
        </div>

        {mangel.beschreibung && (
          <div className="bg-gray-50 p-4 rounded-xl mb-4">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">
              Beschreibung
            </label>
            <p className="text-sm text-gray-700 leading-relaxed">{mangel.beschreibung}</p>
          </div>
        )}

        <p className="text-[10px] text-gray-400 mb-4">
          Erfasst: {new Date(mangel.createdAt).toLocaleString("de-CH")}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={deleteMangel}
            className="flex-1 py-4 bg-gray-100 text-red-500 font-bold rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> Löschen
          </button>
          <button
            onClick={toggleStatus}
            className={`flex-[2] py-4 font-black rounded-xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 ${
              mangel.status === "Offen"
                ? "bg-green-500 text-white shadow-green-200"
                : "bg-gray-800 text-white shadow-gray-400"
            }`}
          >
            {mangel.status === "Offen" ? (
              <>
                <CheckCircle2 size={18} /> Erledigt
              </>
            ) : (
              "Wieder öffnen"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Shared Components ---
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">
        {label}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <input
          type={type}
          className={`w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent ${icon ? "pl-10" : ""}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function ComboField({
  label,
  value,
  onChange,
  placeholder,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: string[];
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = options.filter((o) =>
    o.toLowerCase().includes((filter || value).toLowerCase())
  );

  const handleSelect = (opt: string) => {
    onChange(opt);
    setFilter("");
    setOpen(false);
  };

  const handleInputChange = (v: string) => {
    onChange(v);
    setFilter(v);
    if (!open) setOpen(true);
  };

  return (
    <div className="relative">
      <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">
        {label}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <input
          type="text"
          className={`w-full bg-gray-50 p-3 pr-9 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent ${icon ? "pl-10" : ""}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 max-h-48 overflow-y-auto hide-scrollbar">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 transition-colors ${
                  value === opt ? "bg-red-50 text-red-600 font-bold" : "text-gray-700"
                }`}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-4 py-2.5 text-xs text-gray-400">
              Eigener Wert wird übernommen
            </div>
          )}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

function PrioBadge({
  prio,
  small,
  className = "",
}: {
  prio: string;
  small?: boolean;
  className?: string;
}) {
  const colors: Record<string, string> = {
    Kritisch: "bg-red-600 text-white border-red-600",
    Hoch: "bg-orange-100 text-orange-700 border-orange-200",
    Mittel: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Gering: "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <span
      className={`font-black border uppercase tracking-widest rounded-full ${colors[prio] || "bg-gray-100 text-gray-500 border-gray-200"} ${
        small ? "text-[8px] px-2 py-0.5" : "text-[10px] px-3 py-1"
      } ${className}`}
    >
      {prio}
    </span>
  );
}
