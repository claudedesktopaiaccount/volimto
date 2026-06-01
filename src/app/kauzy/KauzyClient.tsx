"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import {
  KAUZA_CATEGORY_LABELS,
  KAUZA_STATUS_LABELS,
  isClosedStatus,
  type Kauza,
  type KauzaActor,
  type KauzaClaim,
  type KauzaCategory,
  type KauzaConnection,
  type KauzaStatus,
} from "@/lib/scandals";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<KauzaStatus | "all", string> = {
  all: "Všetky",
  ...KAUZA_STATUS_LABELS,
};

const CATEGORY_LABELS: Record<KauzaCategory | "all", string> = {
  all: "Všetky oblasti",
  ...KAUZA_CATEGORY_LABELS,
};

const ALL_POLITICIANS = "all";

type MapNodeType = "case" | "politician" | "institution" | "person" | "company";
type MapNodeKind = "case" | "actor" | "connection";

interface MapNode {
  id: string;
  label: string;
  type: MapNodeType;
  kind: MapNodeKind;
  x: number;
  y: number;
  caseId: string;
  meta?: string;
  extra?: string;
  weight: number;
}

interface MapEdge {
  from: string;
  to: string;
  label: string;
  weight: number;
}

interface MapViewport {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  viewport: MapViewport;
  moved: boolean;
}

type SelectedNodeDetail =
  | { kind: "case"; kauza: Kauza }
  | { kind: "actor"; kauza: Kauza; actor: KauzaActor }
  | { kind: "connection"; kauza: Kauza; connection: KauzaConnection };

const MAP_WIDTH = 1120;
const MAP_HEIGHT = 720;
const DEFAULT_VIEWPORT: MapViewport = { x: 0, y: 0, scale: 1 };
const DRAG_THRESHOLD = 6;

export default function KauzyClient({
  kauzy,
  activeCourtKauzy,
}: {
  kauzy: Kauza[];
  activeCourtKauzy: Kauza[];
}) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<KauzaStatus | "all">("all");
  const [category, setCategory] = useState<KauzaCategory | "all">("all");
  const [politician, setPolitician] = useState(ALL_POLITICIANS);
  const [search, setSearch] = useState("");

  const activeCourtIds = useMemo(
    () => new Set(activeCourtKauzy.map((kauza) => kauza.id)),
    [activeCourtKauzy]
  );

  const politicianOptions = useMemo(() => {
    const byName = new Map<string, string>();

    for (const actor of kauzy.flatMap((kauza) => kauza.actors)) {
      const value = normalize(actor.name);
      if (value && !byName.has(value)) {
        byName.set(value, actor.name);
      }
    }

    return [...byName.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "sk"));
  }, [kauzy]);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    return kauzy
      .filter((kauza) => {
        if (status !== "all" && kauza.status !== status) return false;
        if (category !== "all" && kauza.category !== category) return false;
        if (
          politician !== ALL_POLITICIANS &&
          !kauza.actors.some((actor) => normalize(actor.name) === politician)
        ) {
          return false;
        }
        if (terms.length === 0) return true;

        const haystack = normalize(
          [
            kauza.title,
            kauza.oneLine,
            kauza.summary,
            kauza.statusLabel,
            kauza.actors.map((actor) => actor.name).join(" "),
            kauza.connections.map((connection) => connection.target).join(" "),
          ].join(" ")
        );

        return terms.every((term) => haystack.includes(term));
      })
      .sort((a, b) => {
        const activeDelta = Number(activeCourtIds.has(b.id)) - Number(activeCourtIds.has(a.id));
        if (activeDelta !== 0) return activeDelta;
        return a.courtPriority - b.courtPriority;
      });
  }, [activeCourtIds, category, kauzy, politician, search, status]);

  const selectedCase = selectedCaseId
    ? kauzy.find((kauza) => kauza.id === selectedCaseId) ?? null
    : null;

  const map = useMemo(
    () => (selectedCase ? buildMap(selectedCase, expandedNodeIds) : { nodes: [], edges: [] }),
    [expandedNodeIds, selectedCase]
  );

  const selectedDetail = useMemo(
    () => (selectedCase ? resolveSelectedDetail(selectedCase, selectedNodeId) : null),
    [selectedCase, selectedNodeId]
  );

  const chooseCase = (caseId: string) => {
    const caseNodeId = caseNodeIdFor(caseId);
    setSelectedCaseId(caseId);
    setSelectedNodeId(caseNodeId);
    setExpandedNodeIds(new Set([caseNodeId]));
  };

  const resetSelection = () => {
    setSelectedCaseId(null);
    setSelectedNodeId(null);
    setExpandedNodeIds(new Set());
  };

  const selectNode = (node: MapNode) => {
    setSelectedNodeId(node.id);
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }

      if (node.kind === "case" && !next.has(node.id)) {
        setSelectedNodeId(node.id);
      }

      return next;
    });
  };

  return (
    <div className="space-y-6">
      <section className="border border-border bg-card">
        <FilterBar
          search={search}
          status={status}
          category={category}
          politician={politician}
          politicianOptions={politicianOptions}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onCategoryChange={setCategory}
          onPoliticianChange={setPolitician}
        />

        {!selectedCase ? (
          <CasePicker
            kauzy={filtered}
            activeCourtIds={activeCourtIds}
            onChoose={chooseCase}
          />
        ) : (
          <div>
            <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-label text-muted">Vybraná kauza</p>
                <h2 className="mt-1 text-xl font-extrabold text-ink">{selectedCase.title}</h2>
              </div>
              <button
                type="button"
                onClick={resetSelection}
                className="border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-subtle"
              >
                Vybrať inú kauzu
              </button>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_390px]">
              <MindMap
                key={selectedCase.id}
                nodes={map.nodes}
                edges={map.edges}
                selectedNodeId={selectedNodeId}
                expandedNodeIds={expandedNodeIds}
                onSelect={selectNode}
              />
              {selectedDetail ? <NodeDetail detail={selectedDetail} /> : <EmptyDetail />}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterBar({
  search,
  status,
  category,
  politician,
  politicianOptions,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onPoliticianChange,
}: {
  search: string;
  status: KauzaStatus | "all";
  category: KauzaCategory | "all";
  politician: string;
  politicianOptions: Array<{ value: string; label: string }>;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: KauzaStatus | "all") => void;
  onCategoryChange: (value: KauzaCategory | "all") => void;
  onPoliticianChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Hľadať kauzu, politika, inštitúciu..."
        className="min-w-0 flex-1 border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={politician}
          onChange={(event) => onPoliticianChange(event.target.value)}
          aria-label="Politik"
          data-testid="kauzy-politician-filter"
          className="border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value={ALL_POLITICIANS}>Všetci politici</option>
          {politicianOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as KauzaStatus | "all")}
          aria-label="Stav kauzy"
          className="border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as KauzaCategory | "all")}
          aria-label="Oblasť kauzy"
          className="border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CasePicker({
  kauzy,
  activeCourtIds,
  onChoose,
}: {
  kauzy: Kauza[];
  activeCourtIds: Set<string>;
  onChoose: (caseId: string) => void;
}) {
  if (kauzy.length === 0) {
    return (
      <div data-testid="kauzy-case-picker" className="p-8 text-center text-sm text-muted">
        Žiadna kauza nevyhovuje filtrom.
      </div>
    );
  }

  return (
    <div data-testid="kauzy-case-picker" className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-4">
      {kauzy.map((kauza) => (
        <button
          type="button"
          key={kauza.id}
          data-testid={`kauzy-select-case-${kauza.id}`}
          onClick={() => onChoose(kauza.id)}
          className="group flex min-h-[260px] flex-col bg-card p-4 text-left transition-colors hover:bg-subtle focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ink"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-label text-muted">
                {activeCourtIds.has(kauza.id) ? "Aktívne kauzy navrchu" : CATEGORY_LABELS[kauza.category]}
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-ink">{kauza.title}</h2>
            </div>
            <StatusBadge status={kauza.status}>{kauza.statusLabel}</StatusBadge>
          </div>
          <p className="text-sm leading-relaxed text-secondary">{kauza.oneLine}</p>
          <div className="mt-auto border-t border-border pt-3 text-xs text-muted">
            <span className="font-semibold text-ink">{kauza.court.institution}</span>
            <span className="mt-1 block">{kauza.court.phase}</span>
            <span className="mt-3 inline-flex border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-card transition-colors group-hover:bg-secondary">
              Otvoriť mapu
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function MindMap({
  nodes,
  edges,
  selectedNodeId,
  expandedNodeIds,
  onSelect,
}: {
  nodes: MapNode[];
  edges: MapEdge[];
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  onSelect: (node: MapNode) => void;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_VIEWPORT);
  const [isDragging, setIsDragging] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const isFullscreen = isCssFullscreen || isNativeFullscreen;

  useEffect(() => {
    const handleFullscreenChange = () => {
      const shell = shellRef.current;
      setIsNativeFullscreen(Boolean(shell && document.fullscreenElement === shell));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCssFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-map-control], [data-map-node]")) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewport,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true;
      suppressNextClickRef.current = true;
    }

    setViewport({
      ...drag.viewport,
      x: drag.viewport.x + dx,
      y: drag.viewport.y + dy,
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSelect = (node: MapNode) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onSelect(node);
  };

  const zoomBy = (delta: number) => {
    setViewport((current) => ({
      ...current,
      scale: clamp(Number((current.scale + delta).toFixed(2)), 0.55, 1.7),
    }));
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;

    if (isFullscreen) {
      setIsCssFullscreen(false);
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      }
      return;
    }

    try {
      await shell.requestFullscreen();
      setIsNativeFullscreen(true);
    } catch {
      setIsCssFullscreen(true);
    }
  };

  return (
    <div
      ref={shellRef}
      data-testid="kauzy-map-shell"
      className={cn(
        "relative overflow-hidden border-b border-border bg-subtle touch-none select-none lg:border-b-0 lg:border-r",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        isFullscreen && "fixed inset-0 z-50 border-0"
      )}
    >
      <div
        className={cn("relative h-[720px]", isFullscreen && "h-dvh")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      >
        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-2" data-map-control>
          <button
            type="button"
            className="border border-border bg-card px-3 py-2 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-subtle"
            onClick={() => zoomBy(0.12)}
            aria-label="Priblížiť mapu"
            data-testid="kauzy-map-zoom-in"
          >
            +
          </button>
          <button
            type="button"
            className="border border-border bg-card px-3 py-2 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-subtle"
            onClick={() => zoomBy(-0.12)}
            aria-label="Oddialiť mapu"
            data-testid="kauzy-map-zoom-out"
          >
            -
          </button>
          <button
            type="button"
            className="border border-border bg-card px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-subtle"
            onClick={() => setViewport(DEFAULT_VIEWPORT)}
            data-testid="kauzy-map-reset"
          >
            Reset
          </button>
          <button
            type="button"
            className="border border-ink bg-ink px-3 py-2 text-sm font-semibold text-card shadow-sm transition-colors hover:bg-secondary"
            onClick={toggleFullscreen}
            data-testid="kauzy-map-fullscreen"
          >
            {isFullscreen ? "Zavrieť" : "Celá obrazovka"}
          </button>
        </div>

        <div
          className="absolute left-0 top-0 will-change-transform"
          data-testid="kauzy-map-canvas"
          style={{
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            role="img"
            aria-label="Mapa prepojení medzi kauzou, aktérmi a inštitúciami"
          >
            <defs>
              <pattern id="kauzy-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
              </pattern>
            </defs>
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#kauzy-grid)" className="text-border-strong" />
            {edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;

              const selected = edge.from === selectedNodeId || edge.to === selectedNodeId;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={selected ? "var(--text-primary)" : "var(--border-strong)"}
                  strokeWidth={Math.max(1.4, edge.weight * 0.7)}
                  strokeOpacity={selected ? 0.88 : 0.48}
                >
                  <title>{edge.label}</title>
                </line>
              );
            })}
          </svg>

          {nodes.map((node) => (
            <MapButton
              key={node.id}
              node={node}
              selected={node.id === selectedNodeId}
              expanded={expandedNodeIds.has(node.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MapButton({
  node,
  selected,
  expanded,
  onSelect,
}: {
  node: MapNode;
  selected: boolean;
  expanded: boolean;
  onSelect: (node: MapNode) => void;
}) {
  const isCase = node.type === "case";

  return (
    <button
      type="button"
      data-map-node={node.id}
      data-testid="kauzy-map-node"
      aria-expanded={expanded}
      aria-pressed={selected}
      onClick={() => onSelect(node)}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer overflow-hidden border text-left shadow-[3px_3px_0_rgba(17,17,16,0.08)] transition-colors hover:bg-card focus:outline-none focus:ring-2 focus:ring-ink",
        nodeClasses(node.type),
        selected && "border-ink ring-2 ring-ink"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: isCase ? 240 : 190,
        height: isCase ? 124 : expanded ? 136 : node.kind === "actor" ? 108 : 86,
      }}
    >
      <span className="block text-[10px] font-mono uppercase tracking-[0.12em] text-muted">
        {nodeTypeLabel(node.type)}
      </span>
      <span className="mt-1 block text-[15px] font-extrabold leading-snug text-ink">
        {node.label}
      </span>
      {(expanded || isCase || node.kind === "actor") && node.meta && (
        <span className="mt-1 block text-xs leading-relaxed text-secondary">{node.meta}</span>
      )}
      {expanded && node.extra && (
        <span className="mt-1 block text-[11px] font-semibold leading-relaxed text-muted">{node.extra}</span>
      )}
    </button>
  );
}

function NodeDetail({ detail }: { detail: SelectedNodeDetail }) {
  if (detail.kind === "actor") {
    return <ActorDetail kauza={detail.kauza} actor={detail.actor} />;
  }

  if (detail.kind === "connection") {
    return <ConnectionDetail kauza={detail.kauza} connection={detail.connection} />;
  }

  return <KauzaDetail kauza={detail.kauza} />;
}

function KauzaDetail({ kauza }: { kauza: Kauza }) {
  return (
    <aside className="max-h-[720px] overflow-y-auto bg-card">
      <div className="border-b border-border p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-label text-muted">{CATEGORY_LABELS[kauza.category]}</p>
            <h2 className="mt-1 text-2xl font-extrabold text-ink">{kauza.title}</h2>
          </div>
          <StatusBadge status={kauza.status}>{kauza.statusLabel}</StatusBadge>
        </div>
        <p className="text-sm leading-relaxed text-secondary">{kauza.summary}</p>
        <p className="mt-4 border-l-2 border-ink pl-3 text-xs leading-relaxed text-muted">
          {kauza.legalNote}
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-ink">
          Toto nie je verdikt aplikácie.
        </p>
      </div>

      <DetailSection title="Čo je doložené">
        <ClaimList claims={kauza.claims} />
      </DetailSection>

      <DetailSection title="Čo je právny stav">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Procesný stav</dt>
            <dd className="mt-1 text-ink">{kauza.statusLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Limit záveru</dt>
            <dd className="mt-1 leading-relaxed text-secondary">{kauza.legalNote}</dd>
          </div>
        </dl>
      </DetailSection>

      <DetailSection title="Čo zostáva otvorené">
        <ul className="space-y-2 text-sm leading-relaxed text-secondary">
          {openQuestionsFor(kauza).map((item) => (
            <li key={item} className="border-l border-border pl-3">{item}</li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="Súdny stav">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Inštitúcia</dt>
            <dd className="mt-1 text-ink">{kauza.court.institution}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Fáza</dt>
            <dd className="mt-1 text-ink">{kauza.court.phase}</dd>
          </div>
          {kauza.court.nextStep && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Ďalší krok</dt>
              <dd className="mt-1 text-ink">{kauza.court.nextStep}</dd>
            </div>
          )}
        </dl>
      </DetailSection>

      <DetailSection title="Aktéri">
        <div className="space-y-3">
          {kauza.actors.map((actor) => (
            <ActorCard key={`${kauza.id}-${actor.name}`} actor={actor} />
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Časová os">
        <ol className="space-y-3">
          {kauza.timeline.map((event) => (
            <li key={`${kauza.id}-${event.date}-${event.title}`} className="grid grid-cols-[76px_1fr] gap-3">
              <span className="text-xs font-mono text-muted">{event.date}</span>
              <span>
                <strong className="block text-sm text-ink">{event.title}</strong>
                <span className="mt-1 block text-xs leading-relaxed text-secondary">{event.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </DetailSection>

      <DetailSection title="Zdroje">
        <div className="space-y-2">
          {kauza.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block border border-border bg-surface p-3 transition-colors hover:bg-subtle"
            >
              <span className="block text-xs font-bold text-ink">{source.title}</span>
              <span className="mt-1 block text-[11px] text-muted">
                {source.outlet} · {source.date}
                {source.primary ? " · primárny zdroj" : ""}
              </span>
            </a>
          ))}
        </div>
      </DetailSection>
    </aside>
  );
}

function ActorDetail({ kauza, actor }: { kauza: Kauza; actor: KauzaActor }) {
  const claims = claimsForSubject(kauza.claims, actor.name);

  return (
    <aside className="max-h-[720px] overflow-y-auto bg-card">
      <div className="border-b border-border p-5">
        <p className="text-label text-muted">Aktér v kauze</p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink">{actor.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">{actor.role}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {actor.party && <Badge tone="accent">{actor.party}</Badge>}
          <StatusBadge status={kauza.status}>{kauza.statusLabel}</StatusBadge>
        </div>
      </div>

      <DetailSection title="Čo sa mu pripisuje">
        <ClaimList
          claims={claims}
          emptyText="Pri tomto aktérovi zatiaľ nie je samostatné štruktúrované tvrdenie."
        />
      </DetailSection>

      <DetailSection title="Prepojenie">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Kauza</dt>
            <dd className="mt-1 text-ink">{kauza.title}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Vzťah</dt>
            <dd className="mt-1 text-ink">{actor.relation}</dd>
          </div>
          {actor.activePublicRole && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Verejná funkcia</dt>
              <dd className="mt-1 text-ink">{actor.activePublicRole}</dd>
            </div>
          )}
        </dl>
      </DetailSection>

      {actor.slug && (
        <DetailSection title="Profil">
          <Link
            href={`/poslanci/${actor.slug}`}
            className="inline-flex border border-ink bg-ink px-4 py-2 text-sm font-semibold text-card transition-colors hover:bg-secondary"
          >
            Profil poslanca
          </Link>
        </DetailSection>
      )}
    </aside>
  );
}

function ConnectionDetail({ kauza, connection }: { kauza: Kauza; connection: KauzaConnection }) {
  return (
    <aside className="max-h-[720px] overflow-y-auto bg-card">
      <div className="border-b border-border p-5">
        <p className="text-label text-muted">{connectionTypeLabel(connection.type)}</p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink">{connection.target}</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">{connection.label}</p>
      </div>

      <DetailSection title="Prepojenie">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Kauza</dt>
            <dd className="mt-1 text-ink">{kauza.title}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Typ uzla</dt>
            <dd className="mt-1 text-ink">{connectionTypeLabel(connection.type)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Sila väzby</dt>
            <dd className="mt-1 text-ink">{connection.weight} / 5</dd>
          </div>
        </dl>
      </DetailSection>
    </aside>
  );
}

function ActorCard({ actor }: { actor: KauzaActor }) {
  return (
    <div className="border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          {actor.slug ? (
            <Link
              href={`/poslanci/${actor.slug}`}
              className="font-bold text-ink hover:underline"
            >
              {actor.name}
            </Link>
          ) : (
            <p className="font-bold text-ink">{actor.name}</p>
          )}
          <p className="text-xs text-secondary">{actor.role}</p>
        </div>
        {actor.party && <Badge tone="accent">{actor.party}</Badge>}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{actor.relation}</p>
      {actor.activePublicRole && (
        <p className="mt-1 text-xs font-semibold text-ink">{actor.activePublicRole}</p>
      )}
    </div>
  );
}

function ClaimList({
  claims,
  emptyText = "Zatiaľ nie je pridané štruktúrované tvrdenie.",
}: {
  claims: KauzaClaim[];
  emptyText?: string;
}) {
  if (claims.length === 0) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {claims.map((claim, index) => (
        <article key={`${claim.subjectName}-${claim.statement}-${index}`} className="border border-border bg-surface p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone="accent">{claim.processStatus}</Badge>
            <Badge tone="neutral">{claim.responsibilityKind}</Badge>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            {claim.subjectName} · {claim.claimKind}
          </p>
          {claim.whyRelevant && (
            <p className="mt-2 text-sm leading-relaxed text-ink">{claim.whyRelevant}</p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-ink">{claim.statement}</p>
          {claim.evidenceExcerpt && (
            <p className="mt-2 border-l-2 border-ink pl-3 text-xs leading-relaxed text-secondary">
              {claim.evidenceExcerpt}
            </p>
          )}
          {claim.counterpoint && (
            <p className="mt-2 border-l border-border pl-3 text-xs leading-relaxed text-secondary">
              {claim.counterpoint}
            </p>
          )}
          {claim.sourceType && (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Typ zdroja: {claim.sourceType}
            </p>
          )}
          {claim.sources.length > 0 && (
            <div className="mt-3 space-y-1">
              {claim.sources.map((source) => (
                <a
                  key={`${claim.subjectName}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-semibold text-ink underline decoration-border underline-offset-4 hover:decoration-ink"
                >
                  {source.outlet} · {source.date}
                  {source.primary ? " · primárny zdroj" : ""}
                </a>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function EmptyDetail() {
  return (
    <aside className="bg-card p-8 text-center text-sm text-muted">
      Žiadna kauza nevyhovuje filtrom.
    </aside>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border p-5">
      <h3 className="mb-3 text-label text-muted">{title}</h3>
      {children}
    </section>
  );
}

function StatusBadge({
  status,
  children,
}: {
  status: KauzaStatus;
  children: React.ReactNode;
}) {
  const tone =
    status === "vysetruje_sa" || status === "prebieha"
      ? "danger"
      : isClosedStatus(status)
        ? "success"
        : "neutral";
  return (
    <Badge tone={tone} className="shrink-0">
      {children}
    </Badge>
  );
}

function buildMap(kauza: Kauza, expandedNodeIds: Set<string>): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const caseId = caseNodeIdFor(kauza.id);
  const caseExpanded = expandedNodeIds.has(caseId);

  nodes.push({
    id: caseId,
    label: kauza.shortTitle,
    type: "case",
    kind: "case",
    x: 560,
    y: 360,
    caseId: kauza.id,
    meta: kauza.statusLabel,
    extra: kauza.court.institution,
    weight: kauza.severity,
  });

  if (!caseExpanded) {
    return { nodes, edges };
  }

  kauza.actors.forEach((actor, index) => {
    const actorId = actorNodeIdFor(kauza.id, actor.name);
    const primaryClaim = claimsForSubject(kauza.claims, actor.name)[0];
    nodes.push({
      id: actorId,
      label: actor.name,
      type: "politician",
      kind: "actor",
      x: 250,
      y: spreadY(index, kauza.actors.length),
      caseId: kauza.id,
      meta: primaryClaim ? compactClaim(primaryClaim) : actor.relation,
      extra: actor.activePublicRole ?? actor.role,
      weight: 4,
    });
    edges.push({ from: caseId, to: actorId, label: primaryClaim?.claimKind ?? actor.relation, weight: 4 });
  });

  kauza.connections.forEach((connection, index) => {
    const connectionId = connectionNodeIdFor(kauza.id, connection.target);
    nodes.push({
      id: connectionId,
      label: connection.target,
      type: mapConnectionNodeType(connection.type),
      kind: "connection",
      x: 870,
      y: spreadY(index, kauza.connections.length),
      caseId: kauza.id,
      meta: connection.label,
      extra: connectionTypeLabel(connection.type),
      weight: connection.weight,
    });
    edges.push({ from: caseId, to: connectionId, label: connection.label, weight: connection.weight });
  });

  return { nodes, edges };
}

function resolveSelectedDetail(kauza: Kauza, selectedNodeId: string | null): SelectedNodeDetail {
  if (!selectedNodeId || selectedNodeId === caseNodeIdFor(kauza.id)) {
    return { kind: "case", kauza };
  }

  const actor = kauza.actors.find((item) => actorNodeIdFor(kauza.id, item.name) === selectedNodeId);
  if (actor) {
    return { kind: "actor", kauza, actor };
  }

  const connection = kauza.connections.find(
    (item) => connectionNodeIdFor(kauza.id, item.target) === selectedNodeId
  );
  if (connection) {
    return { kind: "connection", kauza, connection };
  }

  return { kind: "case", kauza };
}

function claimsForSubject(claims: KauzaClaim[], subjectName: string) {
  const normalized = normalize(subjectName);
  return claims.filter((claim) => normalize(claim.subjectName) === normalized);
}

function compactClaim(claim: KauzaClaim) {
  return truncate(`${claim.responsibilityKind}: ${claim.statement}`, 112);
}

function openQuestionsFor(kauza: Kauza) {
  const counterpoints = kauza.claims
    .map((claim) => claim.counterpoint)
    .filter((item): item is string => Boolean(item));

  if (counterpoints.length > 0) {
    return [...new Set(counterpoints)].slice(0, 3);
  }

  if (isClosedStatus(kauza.status)) {
    return ["Záznam treba čítať cez uvedený procesný výsledok a priložené zdroje, nie ako širší politický verdikt."];
  }

  return ["Bez právoplatného rozhodnutia zostáva otvorené, ktoré tvrdenia sa potvrdia v ďalšom konaní."];
}

function truncate(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function spreadY(index: number, total: number) {
  if (total <= 1) return 360;
  const top = 170;
  const bottom = 550;
  return top + (index * (bottom - top)) / (total - 1);
}

function caseNodeIdFor(caseId: string) {
  return `case:${caseId}`;
}

function actorNodeIdFor(caseId: string, name: string) {
  return `actor:${caseId}:${normalize(name)}`;
}

function connectionNodeIdFor(caseId: string, target: string) {
  return `connection:${caseId}:${normalize(target)}`;
}

function mapConnectionNodeType(type: KauzaConnection["type"]): MapNodeType {
  switch (type) {
    case "politician":
      return "politician";
    case "person":
      return "person";
    case "company":
      return "company";
    case "institution":
      return "institution";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function nodeClasses(type: MapNodeType) {
  switch (type) {
    case "case":
      return "border-ink bg-card px-4 py-3";
    case "politician":
      return "border-accent-border bg-accent-soft px-3 py-2";
    case "person":
      return "border-border-strong bg-card px-3 py-2";
    case "company":
      return "border-border-strong bg-card px-3 py-2";
    case "institution":
      return "border-border bg-surface px-3 py-2";
  }
}

function nodeTypeLabel(type: MapNodeType) {
  switch (type) {
    case "case":
      return "Kauza";
    case "politician":
      return "Politik";
    case "person":
      return "Osoba";
    case "company":
      return "Firma";
    case "institution":
      return "Uzol";
  }
}

function connectionTypeLabel(type: KauzaConnection["type"]) {
  switch (type) {
    case "politician":
      return "Politik";
    case "person":
      return "Osoba";
    case "company":
      return "Firma";
    case "institution":
      return "Inštitúcia";
  }
}
