"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  db,
  type Liegenschaft,
  type Asset,
  type Begehung,
  type Mangel,
  ASSET_TYPEN,
  type AssetTyp,
  type AssetStatus,
} from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuid } from "uuid";
import { exportAsZip, downloadBlob } from "@/lib/export";
import { generatePDF } from "@/lib/pdf";
import { importFromZip } from "@/lib/import";
import {
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
  Settings,
  Shield,
  AlertTriangle,
  Flame,
  DoorOpen,
  Wind,
  Lightbulb,
  Bell,
  Eye,
  Droplets,
  Radio,
  HelpCircle,
  ClipboardCheck,
  Play,
  Square,
  ChevronDown,
  Edit2,
  Upload,
} from "lucide-react";

// --- Constants ---
const ORT_OPTIONS = [
  "Treppenhaus A", "Treppenhaus B", "Tiefgarage", "Eingangsbereich",
  "Keller", "Dachboden", "Waschküche", "Heizungsraum", "Technikraum",
  "Aufzug", "Flur / Korridor", "Wohnung", "Büro", "Lager", "Aussenbereich",
];

const GESCHOSS_OPTIONS = [
  "UG2", "UG1", "EG", "1. OG", "2. OG", "3. OG", "4. OG",
  "5. OG", "6. OG", "7. OG", "8. OG", "DG", "Dach",
];

const ASSET_ICONS: Record<string, React.ReactNode> = {
  "Feuerlöscher": <Flame size={18} />,
  "Brandschutztür": <DoorOpen size={18} />,
  "RWA-Anlage": <Wind size={18} />,
  "Notbeleuchtung": <Lightbulb size={18} />,
  "BMA": <Bell size={18} />,
  "Fluchtweg": <Eye size={18} />,
  "Sprinkleranlage": <Droplets size={18} />,
  "Rauchmelder": <Radio size={18} />,
  "Löschposten": <Shield size={18} />,
  "Andere": <HelpCircle size={18} />,
};

type Screen = "list" | "detail";
type DetailTab = "info" | "assets" | "maengel";

// ================================================================
// MAIN APP
// ================================================================
export default function Home() {
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [showMenu, setShowMenu] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddMangel, setShowAddMangel] = useState(false);
  const [showEditLiegenschaft, setShowEditLiegenschaft] = useState(false);
  const [showStartBegehung, setShowStartBegehung] = useState<"Erstbegehung" | "Kontrollbegehung" | null>(null);
  const [viewAsset, setViewAsset] = useState<Asset | null>(null);
  const [viewMangel, setViewMangel] = useState<Mangel | null>(null);
  const [exporting, setExporting] = useState(false);

  // Live queries
  const liegenschaften = useLiveQuery(() => db.liegenschaften.toArray()) ?? [];
  const current = liegenschaften.find((l) => l.id === selectedId) ?? null;

  const assets = useLiveQuery(
    async () => current ? db.assets.where("liegenschaftId").equals(current.id).toArray() : [],
    [current?.id]
  ) ?? [];

  const begehungen = useLiveQuery(
    async () => current ? db.begehungen.where("liegenschaftId").equals(current.id).reverse().sortBy("createdAt") : [],
    [current?.id]
  ) ?? [];

  const maengel = useLiveQuery(
    async () => current ? db.maengel.where("liegenschaftId").equals(current.id).reverse().sortBy("createdAt") : [],
    [current?.id]
  ) ?? [];

  const activeBegehung = begehungen.find((b) => b.status === "Aktiv") ?? null;

  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Register service worker + detect updates
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    });
    // Also check periodically (every 30min)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const applyUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage("SKIP_WAITING");
    });
    window.location.reload();
  };

  // --- Handlers ---
  const openLiegenschaft = (id: string) => {
    setSelectedId(id);
    setDetailTab("info");
    setScreen("detail");
  };

  const goBack = () => {
    setScreen("list");
    setShowMenu(false);
  };

  const handleStartBegehung = (typ: "Erstbegehung" | "Kontrollbegehung") => {
    setShowStartBegehung(typ);
    setShowMenu(false);
  };

  const handleStopBegehung = async () => {
    if (!activeBegehung) return;
    await db.begehungen.update(activeBegehung.id, {
      status: "Abgeschlossen",
      updatedAt: new Date().toISOString(),
    });
  };

  const handleExportZip = async () => {
    if (!current) return;
    setExporting(true);
    try {
      const blob = await exportAsZip(current, maengel, assets);
      downloadBlob(blob, `${current.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.zip`);
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const handleExportPDF = async () => {
    if (!current) return;
    setExporting(true);
    try {
      const blob = await generatePDF(current, maengel, assets, begehungen);
      downloadBlob(blob, `Brandschutzdossier_${current.name.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const handleDeleteLiegenschaft = async () => {
    if (!current || !confirm("Liegenschaft und alle zugehörigen Daten löschen?")) return;
    await db.maengel.where("liegenschaftId").equals(current.id).delete();
    await db.assets.where("liegenschaftId").equals(current.id).delete();
    await db.begehungen.where("liegenschaftId").equals(current.id).delete();
    await db.liegenschaften.delete(current.id);
    setSelectedId(null);
    setScreen("list");
    setShowMenu(false);
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden shadow-2xl border-x border-gray-200 relative">
      {/* Update Banner */}
      {updateAvailable && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between z-50 shrink-0">
          <span className="text-xs font-bold">Neue Version verfügbar</span>
          <button onClick={applyUpdate} className="text-xs bg-white text-blue-600 px-3 py-1 rounded-lg font-bold active:scale-95">
            Jetzt aktualisieren
          </button>
        </div>
      )}

      {screen === "list" ? (
        <LiegenschaftList
          liegenschaften={liegenschaften}
          onSelect={openLiegenschaft}
        />
      ) : current ? (
        <>
          {/* Detail Header */}
          <header className="bg-white px-4 pt-3 pb-2 border-b border-gray-100 shadow-sm z-20">
            <div className="flex justify-between items-start">
              <button onClick={goBack} className="flex items-center gap-1 text-gray-400 text-sm font-bold">
                <ArrowLeft size={18} /> Zurück
              </button>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
              >
                <Settings size={18} />
              </button>
            </div>
            <h1 className="text-lg font-black text-gray-800 mt-1">{current.name}</h1>
            <p className="text-xs text-gray-400">
              {current.strasse}, {current.plz} {current.ort}
            </p>

            {/* Active Begehung Banner */}
            {activeBegehung && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-green-700">
                    {activeBegehung.typ} aktiv
                  </span>
                </div>
                <button
                  onClick={handleStopBegehung}
                  className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg flex items-center gap-1"
                >
                  <Square size={10} /> Beenden
                </button>
              </div>
            )}

            {/* Segmented Tabs */}
            <div className="flex mt-3 bg-gray-100 rounded-xl p-1 gap-1">
              {(["info", "assets", "maengel"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                    detailTab === tab
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-400"
                  }`}
                >
                  {tab === "info" ? "Info" : tab === "assets" ? `Assets (${assets.length})` : `Mängel (${maengel.length})`}
                </button>
              ))}
            </div>
          </header>

          {/* Detail Content */}
          <main className="flex-1 overflow-y-auto hide-scrollbar">
            {detailTab === "info" && (
              <InfoTab
                liegenschaft={current}
                assets={assets}
                maengel={maengel}
                begehungen={begehungen}
              />
            )}
            {detailTab === "assets" && (
              <AssetsTab
                assets={assets}
                onView={setViewAsset}
              />
            )}
            {detailTab === "maengel" && (
              <MaengelTab
                maengel={maengel}
                assets={assets}
                onView={setViewMangel}
              />
            )}
          </main>

          {/* FAB */}
          {(detailTab === "assets" || detailTab === "maengel") && (
            <button
              onClick={() => detailTab === "assets" ? setShowAddAsset(true) : setShowAddMangel(true)}
              className="fixed bottom-6 right-6 z-40 bg-red-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5),0_0_40px_rgba(220,38,38,0.25)] border-[5px] border-white active:scale-90 transition-all"
            >
              <Plus size={26} strokeWidth={3} />
            </button>
          )}

          {/* Settings Menu */}
          {showMenu && (
            <MenuOverlay
              onClose={() => setShowMenu(false)}
              activeBegehung={activeBegehung}
              onStartBegehung={handleStartBegehung}
              onStopBegehung={handleStopBegehung}
              onExportZip={handleExportZip}
              onExportPDF={handleExportPDF}
              onEdit={() => { setShowEditLiegenschaft(true); setShowMenu(false); }}
              onDelete={handleDeleteLiegenschaft}
              exporting={exporting}
            />
          )}
        </>
      ) : null}

      {/* Modals */}
      {showEditLiegenschaft && current && (
        <LiegenschaftFormModal
          liegenschaft={current}
          onClose={() => setShowEditLiegenschaft(false)}
        />
      )}
      {showStartBegehung && current && (
        <StartBegehungModal
          typ={showStartBegehung}
          liegenschaftId={current.id}
          defaultPruefer={current.pruefer}
          onClose={() => setShowStartBegehung(null)}
        />
      )}
      {showAddAsset && current && (
        <AddAssetModal
          liegenschaftId={current.id}
          begehungId={activeBegehung?.id}
          onClose={() => setShowAddAsset(false)}
        />
      )}
      {showAddMangel && current && (
        <AddMangelModal
          liegenschaftId={current.id}
          begehungId={activeBegehung?.id}
          assets={assets}
          onClose={() => setShowAddMangel(false)}
        />
      )}
      {viewAsset && (
        <ViewAssetModal
          asset={viewAsset}
          maengel={maengel.filter((m) => m.assetId === viewAsset.id)}
          onClose={() => setViewAsset(null)}
          onUpdate={(a) => setViewAsset(a)}
        />
      )}
      {viewMangel && (
        <ViewMangelModal
          mangel={viewMangel}
          onClose={() => setViewMangel(null)}
          onUpdate={(m) => setViewMangel(m)}
        />
      )}
    </div>
  );
}

// ================================================================
// SCREEN: Liegenschaft List
// ================================================================
function LiegenschaftList({
  liegenschaften,
  onSelect,
}: {
  liegenschaften: Liegenschaft[];
  onSelect: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importFromZip(file);
      setImportResult(`"${result.liegenschaft}" importiert: ${result.assets} Assets, ${result.maengel} Mängel`);
    } catch (err) {
      setImportResult(`Fehler: ${err instanceof Error ? err.message : 'Import fehlgeschlagen'}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }, []);

  return (
    <>
      <header className="bg-white px-5 py-4 flex justify-between items-center border-b border-gray-100 shadow-sm z-20">
        <div>
          <h1 className="text-xl font-black tracking-tight text-red-600">
            Fire<span className="text-gray-800">Dox</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
            Erfassung
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs cursor-pointer hover:bg-gray-200 transition-colors">
            <Upload size={14} /> Import
            <input ref={importRef} type="file" accept=".zip" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl font-bold text-xs active:scale-95 transition-all shadow-lg shadow-red-200"
          >
            <Plus size={16} /> Neu
          </button>
        </div>
      </header>

      {/* Import status */}
      {(importing || importResult) && (
        <div className={`px-4 py-2 text-xs font-bold shrink-0 ${importing ? "bg-blue-50 text-blue-600" : importResult?.startsWith("Fehler") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {importing ? "Importiere..." : importResult}
          {!importing && (
            <button onClick={() => setImportResult(null)} className="ml-2 underline">OK</button>
          )}
        </div>
      )}

      <main className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-3">
        {liegenschaften.length === 0 ? (
          <div className="text-center text-gray-400 mt-20 space-y-3">
            <Building2 size={48} className="mx-auto text-gray-300" />
            <p className="font-bold">Keine Liegenschaften</p>
            <p className="text-sm">Erstelle eine neue Liegenschaft oder importiere ein ZIP.</p>
          </div>
        ) : (
          liegenschaften.map((l) => (
            <div
              key={l.id}
              onClick={() => onSelect(l.id)}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] hover:border-red-200 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Building2 size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate">{l.name}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {l.strasse}, {l.plz} {l.ort}
                </p>
                {l.gebaeudeart && (
                  <p className="text-[10px] text-gray-300 mt-0.5">{l.gebaeudeart}</p>
                )}
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          ))
        )}
      </main>

      {showAdd && (
        <LiegenschaftFormModal onClose={() => setShowAdd(false)} />
      )}
    </>
  );
}

// ================================================================
// TABS
// ================================================================
function InfoTab({
  liegenschaft,
  assets,
  maengel,
  begehungen,
}: {
  liegenschaft: Liegenschaft;
  assets: Asset[];
  maengel: Mangel[];
  begehungen: Begehung[];
}) {
  const [viewBegehung, setViewBegehung] = useState<Begehung | null>(null);
  const openMaengel = maengel.filter((m) => m.status === "Offen").length;
  const okAssets = assets.filter((a) => a.status === "OK").length;

  if (viewBegehung) {
    const bAssets = assets.filter((a) => a.begehungId === viewBegehung.id);
    const bMaengel = maengel.filter((m) => m.begehungId === viewBegehung.id);

    return (
      <div className="p-4 space-y-4 pb-8 animate-fade-in">
        <button onClick={() => setViewBegehung(null)} className="flex items-center gap-1 text-gray-400 text-sm font-bold">
          <ArrowLeft size={16} /> Zurück
        </button>

        <div className={`p-5 rounded-2xl border ${viewBegehung.status === "Aktiv" ? "bg-green-50 border-green-200" : "bg-white border-gray-100"}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black text-gray-800">{viewBegehung.typ}</h3>
              <p className="text-xs text-gray-400 mt-1">{viewBegehung.datum} | {viewBegehung.pruefer || "-"}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              viewBegehung.status === "Aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {viewBegehung.status}
            </span>
          </div>
          {viewBegehung.notizen && <p className="text-sm text-gray-600 mt-3">{viewBegehung.notizen}</p>}
        </div>

        {/* Stats für diese Begehung */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Erfasste Assets</p>
            <p className="text-2xl font-black text-gray-800">{bAssets.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Erfasste Mängel</p>
            <p className="text-2xl font-black text-red-600">{bMaengel.length}</p>
          </div>
        </div>

        {/* Assets dieser Begehung */}
        {bAssets.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Assets</h3>
            <div className="space-y-2">
              {bAssets.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    a.status === "OK" ? "bg-green-50 text-green-600" :
                    a.status === "Mangelhaft" ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400"
                  }`}>
                    {ASSET_ICONS[a.typ] || <Shield size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{a.bezeichnung || a.typ}</p>
                    <p className="text-[10px] text-gray-400 truncate">{a.ort}{a.geschoss ? `, ${a.geschoss}` : ""}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mängel dieser Begehung */}
        {bMaengel.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Mängel</h3>
            <div className="space-y-2">
              {bMaengel.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <PrioBadge prio={m.prioritaet} small />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{m.titel}</p>
                    <p className="text-[10px] text-gray-400 truncate">{m.ort}{m.geschoss ? `, ${m.geschoss}` : ""}</p>
                  </div>
                  <span className={`text-[10px] font-bold ${m.status === "Offen" ? "text-red-500" : "text-green-500"}`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {bAssets.length === 0 && bMaengel.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <ClipboardCheck size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-sm">Keine Einträge für diese Begehung</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Assets</p>
          <p className="text-2xl font-black text-gray-800">{assets.length}</p>
          <p className="text-[9px] text-green-600 font-bold">{okAssets} OK</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Mängel</p>
          <p className="text-2xl font-black text-red-600">{openMaengel}</p>
          <p className="text-[9px] text-gray-400 font-bold">offen</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Begehungen</p>
          <p className="text-2xl font-black text-gray-800">{begehungen.length}</p>
        </div>
      </div>

      {/* Stammdaten */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Stammdaten</h3>
        <InfoRow label="Gebäudeart" value={liegenschaft.gebaeudeart} />
        <InfoRow label="Baujahr" value={liegenschaft.baujahr} />
        <InfoRow label="Geschosse" value={liegenschaft.anzahlGeschosse} />
        <InfoRow label="Einheiten" value={liegenschaft.anzahlEinheiten} />
        <InfoRow label="Eigentümer" value={liegenschaft.eigentuemer} />
        <InfoRow label="Verwalter" value={liegenschaft.verwalter} />
        <InfoRow label="QS-Verantwortlicher" value={liegenschaft.pruefer} />
      </div>

      {/* Begehungs-Historie */}
      {begehungen.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Begehungen</h3>
          <div className="space-y-2">
            {begehungen.map((b) => {
              const bAssetCount = assets.filter((a) => a.begehungId === b.id).length;
              const bMangelCount = maengel.filter((m) => m.begehungId === b.id).length;
              return (
                <div key={b.id} onClick={() => setViewBegehung(b)}
                  className="flex items-center justify-between py-3 px-1 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors active:scale-[0.98]">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{b.typ}</p>
                    <p className="text-[10px] text-gray-400">{b.datum} | {b.pruefer || "-"}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      {bAssetCount} Assets, {bMangelCount} Mängel
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      b.status === "Aktiv" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {b.status}
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {liegenschaft.notizen && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Notizen</h3>
          <p className="text-sm text-gray-600">{liegenschaft.notizen}</p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-bold text-gray-800">{value}</span>
    </div>
  );
}

function AssetsTab({ assets, onView }: { assets: Asset[]; onView: (a: Asset) => void }) {
  const [filter, setFilter] = useState("");
  const filtered = assets.filter((a) =>
    a.bezeichnung.toLowerCase().includes(filter.toLowerCase()) ||
    a.typ.toLowerCase().includes(filter.toLowerCase()) ||
    a.ort.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Asset suchen..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 hide-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 mt-16">
            <Shield size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-sm">{assets.length === 0 ? "Keine Assets erfasst" : "Keine Treffer"}</p>
            {assets.length === 0 && <p className="text-xs mt-1">Tippe auf + um ein Asset zu erfassen</p>}
          </div>
        ) : (
          filtered.map((asset) => (
            <div
              key={asset.id}
              onClick={() => onView(asset)}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 cursor-pointer active:scale-[0.98] hover:border-red-200 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                asset.status === "OK" ? "bg-green-50 text-green-600" :
                asset.status === "Mangelhaft" ? "bg-red-50 text-red-600" :
                "bg-gray-50 text-gray-400"
              }`}>
                {asset.fotos[0] ? (
                  <img src={asset.fotos[0]} className="w-full h-full object-cover rounded-xl" alt="" />
                ) : (
                  ASSET_ICONS[asset.typ] || <Shield size={18} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 truncate">{asset.bezeichnung || asset.typ}</p>
                <p className="text-[10px] text-gray-400 flex items-center gap-1 truncate">
                  <MapPin size={9} /> {asset.ort}{asset.geschoss ? `, ${asset.geschoss}` : ""}
                </p>
              </div>
              <StatusBadge status={asset.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MaengelTab({
  maengel,
  assets,
  onView,
}: {
  maengel: Mangel[];
  assets: Asset[];
  onView: (m: Mangel) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = maengel.filter((m) =>
    m.titel.toLowerCase().includes(filter.toLowerCase()) ||
    m.ort.toLowerCase().includes(filter.toLowerCase()) ||
    m.beschreibung.toLowerCase().includes(filter.toLowerCase())
  );

  const getAssetName = (id?: string) => {
    if (!id) return null;
    const asset = assets.find((a) => a.id === id);
    return asset ? asset.bezeichnung || asset.typ : null;
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Mangel suchen..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 hide-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 mt-16">
            <AlertTriangle size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-sm">{maengel.length === 0 ? "Keine Mängel erfasst" : "Keine Treffer"}</p>
          </div>
        ) : (
          filtered.map((mangel) => {
            const assetName = getAssetName(mangel.assetId);
            return (
              <div
                key={mangel.id}
                onClick={() => onView(mangel)}
                className={`bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 cursor-pointer active:scale-[0.98] hover:border-red-200 transition-all ${
                  mangel.status === "Erledigt" ? "opacity-60" : ""
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                  mangel.prioritaet === "Kritisch" ? "bg-red-50 text-red-600" :
                  mangel.prioritaet === "Hoch" ? "bg-orange-50 text-orange-600" :
                  "bg-yellow-50 text-yellow-600"
                }`}>
                  {mangel.fotos[0] ? (
                    <img src={mangel.fotos[0]} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">{mangel.titel}</p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 truncate">
                    <MapPin size={9} /> {mangel.ort}
                    {assetName && <span className="text-gray-300">| {assetName}</span>}
                  </p>
                </div>
                <PrioBadge prio={mangel.prioritaet} small />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ================================================================
// MODALS
// ================================================================

// --- Menu Overlay ---
// --- Start Begehung Modal ---
function StartBegehungModal({
  typ,
  liegenschaftId,
  defaultPruefer,
  onClose,
}: {
  typ: "Erstbegehung" | "Kontrollbegehung";
  liegenschaftId: string;
  defaultPruefer: string;
  onClose: () => void;
}) {
  const [pruefer, setPruefer] = useState(defaultPruefer);
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [notizen, setNotizen] = useState("");
  const [saving, setSaving] = useState(false);

  const start = async () => {
    if (!pruefer) return;
    setSaving(true);
    try {
      await db.begehungen.add({
        id: uuid(),
        liegenschaftId,
        typ,
        datum,
        pruefer,
        status: "Aktiv",
        notizen,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title={`${typ} starten`}>
      <div className="space-y-4">
        <div className={`p-4 rounded-xl ${typ === "Erstbegehung" ? "bg-blue-50 border border-blue-200" : "bg-green-50 border border-green-200"}`}>
          <p className="text-sm text-gray-700">
            {typ === "Erstbegehung"
              ? "Erstmalige Erfassung aller Brandschutz-Assets und Mängel der Liegenschaft."
              : "Kontrollbegehung zur Prüfung der bestehenden Assets. Neue Feststellungen werden dieser Begehung zugeordnet."}
          </p>
        </div>

        <Field label="Prüfer / Verantwortlicher *" value={pruefer} onChange={setPruefer} placeholder="Name des Prüfers" />
        <Field label="Datum" value={datum} onChange={setDatum} type="date" />
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Notizen (optional)</label>
          <textarea
            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent min-h-[60px]"
            placeholder="Anmerkungen zur Begehung..."
            value={notizen}
            onChange={(e) => setNotizen(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-bold text-sm">Abbrechen</button>
          <button
            onClick={start}
            disabled={saving || !pruefer}
            className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play size={18} /> {saving ? "Starte..." : "Begehung starten"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function MenuOverlay({
  onClose, activeBegehung, onStartBegehung, onStopBegehung,
  onExportZip, onExportPDF, onEdit, onDelete, exporting,
}: {
  onClose: () => void;
  activeBegehung: Begehung | null;
  onStartBegehung: (typ: "Erstbegehung" | "Kontrollbegehung") => void;
  onStopBegehung: () => void;
  onExportZip: () => void;
  onExportPDF: () => void;
  onEdit: () => void;
  onDelete: () => void;
  exporting: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={onClose}>
      <div
        className="absolute top-16 right-4 bg-white rounded-2xl shadow-2xl border border-gray-100 w-64 animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 space-y-0.5">
          {!activeBegehung ? (
            <>
              <MenuItem icon={<Play size={16} />} label="Erstbegehung starten" onClick={() => onStartBegehung("Erstbegehung")} />
              <MenuItem icon={<ClipboardCheck size={16} />} label="Kontrollbegehung starten" onClick={() => onStartBegehung("Kontrollbegehung")} />
            </>
          ) : (
            <MenuItem icon={<Square size={16} />} label="Begehung abschliessen" onClick={onStopBegehung} color="text-green-600" />
          )}
          <div className="border-t border-gray-100 my-1" />
          <MenuItem icon={<FileDown size={16} />} label="PDF Report" onClick={onExportPDF} disabled={exporting} />
          <MenuItem icon={<Download size={16} />} label="ZIP Export" onClick={onExportZip} disabled={exporting} />
          <div className="border-t border-gray-100 my-1" />
          <MenuItem icon={<Edit2 size={16} />} label="Liegenschaft bearbeiten" onClick={onEdit} />
          <MenuItem icon={<Trash2 size={16} />} label="Löschen" onClick={onDelete} color="text-red-500" />
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, color, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; color?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 ${color || "text-gray-700"}`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Liegenschaft Form Modal ---
function LiegenschaftFormModal({
  liegenschaft,
  onClose,
}: {
  liegenschaft?: Liegenschaft;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: liegenschaft?.name ?? "",
    strasse: liegenschaft?.strasse ?? "",
    plz: liegenschaft?.plz ?? "",
    ort: liegenschaft?.ort ?? "",
    gebaeudeart: liegenschaft?.gebaeudeart ?? "",
    baujahr: liegenschaft?.baujahr ?? "",
    anzahlGeschosse: liegenschaft?.anzahlGeschosse ?? "",
    anzahlEinheiten: liegenschaft?.anzahlEinheiten ?? "",
    eigentuemer: liegenschaft?.eigentuemer ?? "",
    verwalter: liegenschaft?.verwalter ?? "",
    pruefer: liegenschaft?.pruefer ?? "",
    notizen: liegenschaft?.notizen ?? "",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name || !form.strasse) return;
    setSaving(true);
    try {
      if (liegenschaft) {
        await db.liegenschaften.update(liegenschaft.id, { ...form, updatedAt: new Date().toISOString() });
      } else {
        await db.liegenschaften.add({
          id: uuid(), ...form,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title={liegenschaft ? "Liegenschaft bearbeiten" : "Neue Liegenschaft"}>
      <div className="space-y-4">
        <Field label="Objektname *" value={form.name} onChange={(v) => u("name", v)} placeholder="z.B. Mühlegasse 14" />
        <Field label="Strasse / Nr. *" value={form.strasse} onChange={(v) => u("strasse", v)} placeholder="z.B. Mühlegasse 14" />
        <div className="grid grid-cols-3 gap-3">
          <Field label="PLZ" value={form.plz} onChange={(v) => u("plz", v)} placeholder="8000" />
          <div className="col-span-2">
            <Field label="Ort" value={form.ort} onChange={(v) => u("ort", v)} placeholder="Zürich" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Gebäudeart</label>
            <select value={form.gebaeudeart} onChange={(e) => u("gebaeudeart", e.target.value)}
              className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent">
              <option value="">Auswählen...</option>
              <option value="Wohngebäude">Wohngebäude</option>
              <option value="Büro / Gewerbe">Büro / Gewerbe</option>
              <option value="Mischnutzung">Mischnutzung</option>
              <option value="Industrie">Industrie</option>
              <option value="Öffentlich">Öffentlich</option>
              <option value="Andere">Andere</option>
            </select>
          </div>
          <Field label="Baujahr" value={form.baujahr} onChange={(v) => u("baujahr", v)} placeholder="1985" type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Geschosse" value={form.anzahlGeschosse} onChange={(v) => u("anzahlGeschosse", v)} placeholder="5" type="number" />
          <Field label="Einheiten" value={form.anzahlEinheiten} onChange={(v) => u("anzahlEinheiten", v)} placeholder="12" type="number" />
        </div>
        <Field label="Eigentümer" value={form.eigentuemer} onChange={(v) => u("eigentuemer", v)} placeholder="Muster AG" />
        <Field label="Verwalter" value={form.verwalter} onChange={(v) => u("verwalter", v)} placeholder="Immobilia GmbH" />
        <Field label="QS-Verantwortlicher" value={form.pruefer} onChange={(v) => u("pruefer", v)} placeholder="Edin Zolj" />
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Notizen</label>
          <textarea className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent min-h-[60px]"
            placeholder="..." value={form.notizen} onChange={(e) => u("notizen", e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-bold text-sm">Abbrechen</button>
          <button onClick={save} disabled={saving || !form.name || !form.strasse}
            className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// --- Add Asset Modal ---
function AddAssetModal({
  liegenschaftId,
  begehungId,
  onClose,
}: {
  liegenschaftId: string;
  begehungId?: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    typ: "Feuerlöscher" as AssetTyp,
    bezeichnung: "",
    ort: "",
    geschoss: "",
    status: "OK" as AssetStatus,
    letztePruefung: new Date().toISOString().split("T")[0],
    naechstePruefung: "",
    notizen: "",
  });
  const [mangelBeschreibung, setMangelBeschreibung] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") setFotos((p) => [...p, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const save = async () => {
    if (!form.ort) return;
    setSaving(true);
    try {
      const assetId = uuid();
      const now = new Date().toISOString();
      await db.assets.add({
        id: assetId,
        liegenschaftId,
        begehungId,
        typ: form.typ,
        bezeichnung: form.bezeichnung || form.typ,
        ort: form.ort,
        geschoss: form.geschoss,
        status: form.status,
        fotos,
        letztePruefung: form.letztePruefung,
        naechstePruefung: form.naechstePruefung,
        notizen: form.notizen,
        createdAt: now,
        updatedAt: now,
      });
      // Auto-create Mangel if status is Mangelhaft
      if (form.status === "Mangelhaft" && mangelBeschreibung) {
        await db.maengel.add({
          id: uuid(),
          liegenschaftId,
          begehungId,
          assetId,
          titel: `${form.bezeichnung || form.typ}: Mangel festgestellt`,
          beschreibung: mangelBeschreibung,
          ort: form.ort,
          geschoss: form.geschoss,
          prioritaet: "Hoch",
          status: "Offen",
          fotos,
          createdAt: now,
          updatedAt: now,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Asset erfassen">
      <div className="space-y-4">
        <PhotoCapture fotos={fotos} onAdd={handlePhoto} onRemove={(i) => setFotos((p) => p.filter((_, j) => j !== i))} />

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Typ</label>
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TYPEN.slice(0, 9).map((t) => (
              <button key={t} onClick={() => setForm((p) => ({ ...p, typ: t }))}
                className={`py-2 px-1 text-[9px] font-bold rounded-xl border transition-all flex flex-col items-center gap-1 ${
                  form.typ === t ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-200" : "bg-gray-50 text-gray-500 border-gray-100"
                }`}>
                {ASSET_ICONS[t]}
                {t}
              </button>
            ))}
          </div>
        </div>

        <Field label="Bezeichnung" value={form.bezeichnung} onChange={(v) => setForm((p) => ({ ...p, bezeichnung: v }))}
          placeholder={`z.B. ${form.typ} EG Eingang`} />

        <div className="grid grid-cols-2 gap-3">
          <ComboField label="Ort / Bereich *" value={form.ort} onChange={(v) => setForm((p) => ({ ...p, ort: v }))}
            placeholder="Auswählen..." options={ORT_OPTIONS} icon={<MapPin size={16} className="text-gray-300" />} />
          <ComboField label="Geschoss" value={form.geschoss} onChange={(v) => setForm((p) => ({ ...p, geschoss: v }))}
            placeholder="Auswählen..." options={GESCHOSS_OPTIONS} icon={<Layers size={16} className="text-gray-300" />} />
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Status</label>
          <div className="grid grid-cols-3 gap-2">
            {(["OK", "Mangelhaft", "Nicht geprüft"] as const).map((s) => (
              <button key={s} onClick={() => setForm((p) => ({ ...p, status: s }))}
                className={`py-2.5 text-[10px] font-black rounded-xl border transition-all ${
                  form.status === s
                    ? s === "OK" ? "bg-green-600 text-white border-green-600" :
                      s === "Mangelhaft" ? "bg-red-600 text-white border-red-600" :
                      "bg-gray-600 text-white border-gray-600"
                    : "bg-gray-50 text-gray-400 border-gray-100"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Mangel-Beschreibung wenn Status Mangelhaft */}
        {form.status === "Mangelhaft" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-red-700">Mangel wird automatisch in der Mängelliste erfasst</p>
            <div>
              <label className="text-[10px] font-black text-red-400 uppercase mb-1.5 block tracking-widest">Mangelbeschreibung</label>
              <textarea
                className="w-full bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-red-200 min-h-[60px]"
                placeholder="Was genau ist der Mangel?"
                value={mangelBeschreibung}
                onChange={(e) => setMangelBeschreibung(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Letzte Prüfung" value={form.letztePruefung} onChange={(v) => setForm((p) => ({ ...p, letztePruefung: v }))} type="date" />
          <Field label="Nächste Prüfung" value={form.naechstePruefung} onChange={(v) => setForm((p) => ({ ...p, naechstePruefung: v }))} type="date" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-bold text-sm">Abbrechen</button>
          <button onClick={save} disabled={saving || !form.ort}
            className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50">
            {saving ? "Speichere..." : "Asset Speichern"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// --- Add Mangel Modal ---
function AddMangelModal({
  liegenschaftId,
  begehungId,
  assets,
  onClose,
}: {
  liegenschaftId: string;
  begehungId?: string;
  assets: Asset[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    titel: "",
    beschreibung: "",
    ort: "",
    geschoss: "",
    prioritaet: "Mittel" as Mangel["prioritaet"],
    assetId: "",
  });
  const [fotos, setFotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") setFotos((p) => [...p, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const save = async () => {
    if (!form.titel || !form.ort) return;
    setSaving(true);
    try {
      await db.maengel.add({
        id: uuid(),
        liegenschaftId,
        begehungId,
        assetId: form.assetId || undefined,
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
      // If linked to asset, mark it as Mangelhaft
      if (form.assetId) {
        await db.assets.update(form.assetId, { status: "Mangelhaft", updatedAt: new Date().toISOString() });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Mangel erfassen">
      <div className="space-y-4">
        <PhotoCapture fotos={fotos} onAdd={handlePhoto} onRemove={(i) => setFotos((p) => p.filter((_, j) => j !== i))} />

        <Field label="Was wurde festgestellt? *" value={form.titel} onChange={(v) => setForm((p) => ({ ...p, titel: v }))}
          placeholder="z.B. Defekte Brandschutzklappe" />

        <div className="grid grid-cols-2 gap-3">
          <ComboField label="Ort / Bereich *" value={form.ort} onChange={(v) => setForm((p) => ({ ...p, ort: v }))}
            placeholder="Auswählen..." options={ORT_OPTIONS} icon={<MapPin size={16} className="text-gray-300" />} />
          <ComboField label="Geschoss" value={form.geschoss} onChange={(v) => setForm((p) => ({ ...p, geschoss: v }))}
            placeholder="Auswählen..." options={GESCHOSS_OPTIONS} icon={<Layers size={16} className="text-gray-300" />} />
        </div>

        {assets.length > 0 && (
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Asset zuordnen (optional)</label>
            <select value={form.assetId} onChange={(e) => setForm((p) => ({ ...p, assetId: e.target.value }))}
              className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent">
              <option value="">Kein Asset</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.bezeichnung || a.typ} ({a.ort})</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Priorität</label>
          <div className="grid grid-cols-4 gap-2">
            {(["Gering", "Mittel", "Hoch", "Kritisch"] as const).map((p) => (
              <button key={p} onClick={() => setForm((prev) => ({ ...prev, prioritaet: p }))}
                className={`py-2.5 text-[10px] font-black rounded-xl border transition-all ${
                  form.prioritaet === p
                    ? p === "Kritisch" ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-200" :
                      p === "Hoch" ? "bg-orange-500 text-white border-orange-500" :
                      p === "Mittel" ? "bg-yellow-500 text-white border-yellow-500" :
                      "bg-green-600 text-white border-green-600"
                    : "bg-gray-50 text-gray-400 border-gray-100"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Beschreibung</label>
          <textarea className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent min-h-[60px]"
            placeholder="Details zum Mangel..." value={form.beschreibung} onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-bold text-sm">Abbrechen</button>
          <button onClick={save} disabled={saving || !form.titel || !form.ort}
            className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50">
            {saving ? "Speichere..." : "Mangel Senden"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// --- View Asset Modal ---
function ViewAssetModal({ asset, maengel, onClose, onUpdate }: {
  asset: Asset; maengel: Mangel[]; onClose: () => void; onUpdate: (a: Asset) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [form, setForm] = useState({
    typ: asset.typ,
    bezeichnung: asset.bezeichnung,
    ort: asset.ort,
    geschoss: asset.geschoss,
    status: asset.status,
    letztePruefung: asset.letztePruefung,
    naechstePruefung: asset.naechstePruefung,
    notizen: asset.notizen,
  });
  const [fotos, setFotos] = useState(asset.fotos);
  const [saving, setSaving] = useState(false);

  const deleteAsset = async () => {
    if (!confirm("Asset löschen?")) return;
    await db.assets.delete(asset.id);
    onClose();
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") setFotos((p) => [...p, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = { ...form, fotos, updatedAt: new Date().toISOString() };
      await db.assets.update(asset.id, updated);
      onUpdate({ ...asset, ...updated });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <BottomSheet onClose={() => setEditing(false)} title="Asset bearbeiten">
        <div className="space-y-4">
          <PhotoCapture fotos={fotos} onAdd={handlePhoto} onRemove={(i) => setFotos((p) => p.filter((_, j) => j !== i))} />

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Typ</label>
            <div className="grid grid-cols-3 gap-2">
              {ASSET_TYPEN.slice(0, 9).map((t) => (
                <button key={t} onClick={() => setForm((p) => ({ ...p, typ: t }))}
                  className={`py-2 px-1 text-[9px] font-bold rounded-xl border transition-all flex flex-col items-center gap-1 ${
                    form.typ === t ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-200" : "bg-gray-50 text-gray-500 border-gray-100"
                  }`}>
                  {ASSET_ICONS[t]}
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Field label="Bezeichnung" value={form.bezeichnung} onChange={(v) => setForm((p) => ({ ...p, bezeichnung: v }))}
            placeholder={`z.B. ${form.typ} EG Eingang`} />

          <div className="grid grid-cols-2 gap-3">
            <ComboField label="Ort / Bereich *" value={form.ort} onChange={(v) => setForm((p) => ({ ...p, ort: v }))}
              placeholder="Auswählen..." options={ORT_OPTIONS} icon={<MapPin size={16} className="text-gray-300" />} />
            <ComboField label="Geschoss" value={form.geschoss} onChange={(v) => setForm((p) => ({ ...p, geschoss: v }))}
              placeholder="Auswählen..." options={GESCHOSS_OPTIONS} icon={<Layers size={16} className="text-gray-300" />} />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(["OK", "Mangelhaft", "Nicht geprüft"] as const).map((s) => (
                <button key={s} onClick={() => setForm((p) => ({ ...p, status: s }))}
                  className={`py-2.5 text-[10px] font-black rounded-xl border transition-all ${
                    form.status === s
                      ? s === "OK" ? "bg-green-600 text-white border-green-600" :
                        s === "Mangelhaft" ? "bg-red-600 text-white border-red-600" :
                        "bg-gray-600 text-white border-gray-600"
                      : "bg-gray-50 text-gray-400 border-gray-100"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Letzte Prüfung" value={form.letztePruefung} onChange={(v) => setForm((p) => ({ ...p, letztePruefung: v }))} type="date" />
            <Field label="Nächste Prüfung" value={form.naechstePruefung} onChange={(v) => setForm((p) => ({ ...p, naechstePruefung: v }))} type="date" />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">Notizen</label>
            <textarea className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent min-h-[60px]"
              value={form.notizen} onChange={(e) => setForm((p) => ({ ...p, notizen: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-4 text-gray-400 font-bold text-sm">Abbrechen</button>
            <button onClick={saveEdit} disabled={saving || !form.ort}
              className="flex-[2] py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Speichere..." : "Speichern"}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose} title={asset.bezeichnung || asset.typ}>
      <div className="space-y-4">
        {asset.fotos.length > 0 && (
          <div className="w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden relative">
            <img src={asset.fotos[fotoIdx]} className="w-full h-full object-cover" alt="" />
            {asset.fotos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {asset.fotos.map((_, i) => (
                  <button key={i} onClick={() => setFotoIdx(i)}
                    className={`w-2 h-2 rounded-full ${i === fotoIdx ? "bg-white scale-125" : "bg-white/50"}`} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 p-3 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Typ</label>
            <p className="text-sm font-bold text-gray-800">{asset.typ}</p>
          </div>
          <div className="flex-1 bg-gray-50 p-3 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
            <StatusBadge status={asset.status} />
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-xl">
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Ort</label>
          <p className="text-sm font-bold text-gray-800">{asset.ort}{asset.geschoss ? `, ${asset.geschoss}` : ""}</p>
        </div>

        {(asset.letztePruefung || asset.naechstePruefung) && (
          <div className="flex gap-3">
            {asset.letztePruefung && (
              <div className="flex-1 bg-gray-50 p-3 rounded-xl">
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Letzte Prüfung</label>
                <p className="text-sm font-bold text-gray-800">{asset.letztePruefung}</p>
              </div>
            )}
            {asset.naechstePruefung && (
              <div className="flex-1 bg-gray-50 p-3 rounded-xl">
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Nächste Prüfung</label>
                <p className="text-sm font-bold text-gray-800">{asset.naechstePruefung}</p>
              </div>
            )}
          </div>
        )}

        {asset.notizen && (
          <div className="bg-gray-50 p-3 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Notizen</label>
            <p className="text-sm text-gray-600">{asset.notizen}</p>
          </div>
        )}

        {maengel.length > 0 && (
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Zugehörige Mängel</label>
            {maengel.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-2 border-b border-gray-50">
                <PrioBadge prio={m.prioritaet} small />
                <span className="text-sm text-gray-800">{m.titel}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={deleteAsset} className="py-4 px-4 bg-gray-100 text-red-500 font-bold rounded-xl text-sm flex items-center justify-center gap-2">
            <Trash2 size={18} />
          </button>
          <button onClick={() => setEditing(true)}
            className="flex-1 py-4 font-black rounded-xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-red-600 text-white shadow-red-200">
            <Edit2 size={18} /> Bearbeiten
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// --- View Mangel Modal ---
function ViewMangelModal({ mangel, onClose, onUpdate }: {
  mangel: Mangel; onClose: () => void; onUpdate: (m: Mangel) => void;
}) {
  const [fotoIdx, setFotoIdx] = useState(0);

  const toggleStatus = async () => {
    const next = mangel.status === "Offen" ? "Erledigt" : "Offen";
    await db.maengel.update(mangel.id, { status: next, updatedAt: new Date().toISOString() });
    onUpdate({ ...mangel, status: next });
  };

  const deleteMangel = async () => {
    if (!confirm("Mangel löschen?")) return;
    await db.maengel.delete(mangel.id);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} title={mangel.titel}>
      <div className="space-y-4">
        {mangel.fotos.length > 0 && (
          <div className="w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden relative">
            <img src={mangel.fotos[fotoIdx]} className="w-full h-full object-cover" alt="" />
            <PrioBadge prio={mangel.prioritaet} className="absolute top-3 left-3" />
            {mangel.fotos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mangel.fotos.map((_, i) => (
                  <button key={i} onClick={() => setFotoIdx(i)}
                    className={`w-2 h-2 rounded-full ${i === fotoIdx ? "bg-white scale-125" : "bg-white/50"}`} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 p-3 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Ort</label>
            <div className="flex items-center gap-1 font-bold text-sm text-gray-800">
              <MapPin size={14} className="text-red-500" /> {mangel.ort}{mangel.geschoss ? ` (${mangel.geschoss})` : ""}
            </div>
          </div>
          <div className="flex-1 bg-gray-50 p-3 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
            <div className={`flex items-center gap-1 font-bold text-sm ${mangel.status === "Offen" ? "text-red-600" : "text-green-600"}`}>
              {mangel.status === "Offen" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {mangel.status}
            </div>
          </div>
        </div>

        {mangel.beschreibung && (
          <div className="bg-gray-50 p-3 rounded-xl">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Beschreibung</label>
            <p className="text-sm text-gray-600">{mangel.beschreibung}</p>
          </div>
        )}

        <p className="text-[10px] text-gray-400">Erfasst: {new Date(mangel.createdAt).toLocaleString("de-CH")}</p>

        <div className="flex gap-3">
          <button onClick={deleteMangel} className="flex-1 py-4 bg-gray-100 text-red-500 font-bold rounded-xl text-sm flex items-center justify-center gap-2">
            <Trash2 size={18} /> Löschen
          </button>
          <button onClick={toggleStatus}
            className={`flex-[2] py-4 font-black rounded-xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 ${
              mangel.status === "Offen" ? "bg-green-500 text-white shadow-green-200" : "bg-gray-800 text-white"
            }`}>
            {mangel.status === "Offen" ? <><CheckCircle2 size={18} /> Erledigt</> : "Wieder öffnen"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ================================================================
// SHARED COMPONENTS
// ================================================================
function BottomSheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end animate-fade-in backdrop-blur-sm">
      <div className="bg-white w-full max-w-md mx-auto rounded-t-[2rem] p-6 animate-slide-up max-h-[92vh] overflow-y-auto hide-scrollbar shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-black text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PhotoCapture({ fotos, onAdd, onRemove }: {
  fotos: string[];
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Fotos</label>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {fotos.map((foto, i) => (
          <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
            <img src={foto} className="w-full h-full object-cover" alt="" />
            <button onClick={() => onRemove(i)} className="absolute top-1 right-1 bg-black/60 text-white p-0.5 rounded-full"><X size={10} /></button>
          </div>
        ))}
        <label className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-red-400 transition-colors">
          <Camera size={20} className="text-gray-300" />
          <span className="text-[8px] text-gray-400 font-bold">Foto</span>
          <input type="file" accept="image/*" capture="environment" onChange={onAdd} className="hidden" multiple />
        </label>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <input type={type} className={`w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent ${icon ? "pl-10" : ""}`}
          placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function ComboField({ label, value, onChange, placeholder, options, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; options: string[]; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter((o) => o.toLowerCase().includes((value || "").toLowerCase()));

  return (
    <div className="relative">
      <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <input type="text" className={`w-full bg-gray-50 p-3 pr-9 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium border border-transparent ${icon ? "pl-10" : ""}`}
          placeholder={placeholder} value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
        <button type="button" onClick={() => setOpen(!open)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300">
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <>
          <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 max-h-40 overflow-y-auto hide-scrollbar">
            {filtered.length > 0 ? filtered.map((opt) => (
              <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-red-50 ${value === opt ? "bg-red-50 text-red-600 font-bold" : "text-gray-700"}`}>
                {opt}
              </button>
            )) : (
              <div className="px-4 py-2 text-xs text-gray-400">Eigener Wert wird übernommen</div>
            )}
          </div>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

function PrioBadge({ prio, small, className = "" }: { prio: string; small?: boolean; className?: string }) {
  const colors: Record<string, string> = {
    Kritisch: "bg-red-600 text-white border-red-600",
    Hoch: "bg-orange-100 text-orange-700 border-orange-200",
    Mittel: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Gering: "bg-green-100 text-green-700 border-green-200",
  };
  return (
    <span className={`font-black border uppercase tracking-widest rounded-full ${colors[prio] || "bg-gray-100 text-gray-500 border-gray-200"} ${
      small ? "text-[8px] px-2 py-0.5" : "text-[10px] px-3 py-1"} ${className}`}>
      {prio}
    </span>
  );
}

function StatusBadge({ status }: { status: AssetStatus }) {
  const colors: Record<string, string> = {
    OK: "bg-green-50 text-green-600",
    Mangelhaft: "bg-red-50 text-red-600",
    "Nicht geprüft": "bg-gray-100 text-gray-500",
  };
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${colors[status]}`}>{status}</span>;
}
