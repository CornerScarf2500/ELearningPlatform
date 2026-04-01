import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Modal } from "../ui/Modal";

type FieldType = "text" | "list" | "suggest" | "material-list";

interface Field {
  label: string;
  key: string;
  value: string;
  type?: FieldType;
  placeholder?: string;
  addLabel?: string;
  suggestions?: string[];   // for type="suggest"
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: Field[];
  onSave: (values: Record<string, string>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

// ── Dynamic list field ─────────────────────────────────────────
const ListField = ({
  label, addLabel, placeholder, initial, onChange,
}: {
  label: string;
  addLabel?: string;
  placeholder?: string;
  initial: string[];
  onChange: (items: string[]) => void;
}) => {
  const [items, setItems] = useState<string[]>(initial.length ? initial : [""]);
  const update = (next: string[]) => { setItems(next); onChange(next); };

  return (
    <div>
      <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={val}
              placeholder={placeholder}
              onChange={(e) => { const n = [...items]; n[i] = e.target.value; update(n); }}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
            />
            <button onClick={() => update(items.filter((_, idx) => idx !== i))} type="button"
              className="p-1.5 text-red-400 hover:text-red-600 transition-colors shrink-0" title="Remove">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => update([...items, ""])} type="button"
        className="mt-2 flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
        <Plus className="w-3.5 h-3.5" />{addLabel || "+ Add"}
      </button>
    </div>
  );
};

// ── Material list field (URL + optional Name) ──────────────────
interface MaterialItem {
  url: string;
  name: string;
}

const MaterialListField = ({
  label, addLabel, placeholder, initial, onChange,
}: {
  label: string;
  addLabel?: string;
  placeholder?: string;
  initial: MaterialItem[];
  onChange: (items: MaterialItem[]) => void;
}) => {
  const [items, setItems] = useState<MaterialItem[]>(initial.length ? initial : [{ url: "", name: "" }]);
  const update = (next: MaterialItem[]) => { setItems(next); onChange(next); };

  return (
    <div>
      <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50/50 dark:bg-zinc-800/30">
            <div className="flex-1 space-y-1.5">
              <input
                type="text"
                value={item.url}
                placeholder={placeholder || "URL"}
                onChange={(e) => { const n = [...items]; n[i] = { ...n[i], url: e.target.value }; update(n); }}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
              />
              <input
                type="text"
                value={item.name}
                placeholder="Display name (optional)"
                onChange={(e) => { const n = [...items]; n[i] = { ...n[i], name: e.target.value }; update(n); }}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-shadow"
              />
            </div>
            <button onClick={() => update(items.filter((_, idx) => idx !== i))} type="button"
              className="p-1.5 mt-1 text-red-400 hover:text-red-600 transition-colors shrink-0" title="Remove">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => update([...items, { url: "", name: "" }])} type="button"
        className="mt-2 flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
        <Plus className="w-3.5 h-3.5" />{addLabel || "+ Add Material"}
      </button>
    </div>
  );
};

// ── Suggest (autocomplete) input ───────────────────────────────
const SuggestInput = ({
  label, placeholder, suggestions = [], value: initial, onChange,
}: {
  label: string;
  placeholder?: string;
  suggestions?: string[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                onMouseDown={() => { setValue(s); onChange(s); setOpen(false); }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Main modal ──────────────────────────────────────────────────
export const AdminEditModal = ({ open, onClose, title, fields, onSave, onDelete }: Props) => {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(fields.map((f) => [f.key, f.value])));
    }
  }, [open, fields]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(values); onClose(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("Are you sure you want to delete this item?")) return;
    setDeleting(true);
    try { await onDelete(); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {fields.map((field) =>
          field.type === "material-list" ? (
            <MaterialListField
              key={field.key}
              label={field.label}
              addLabel={field.addLabel}
              placeholder={field.placeholder}
              initial={(() => {
                // Parse from serialized JSON string or newline-separated URLs
                try {
                  const parsed = JSON.parse(field.value);
                  if (Array.isArray(parsed)) {
                    return parsed.map((item: string | { url: string; name?: string }) =>
                      typeof item === "string" ? { url: item, name: "" } : { url: item.url || "", name: item.name || "" }
                    );
                  }
                } catch {}
                // Fallback: treat as newline-separated URLs
                const urls = field.value ? field.value.split("\n").map(s => s.trim()).filter(Boolean) : [];
                return urls.map(u => ({ url: u, name: "" }));
              })()}
              onChange={(items) => {
                // Serialize as JSON so the save handler can parse it back
                const cleaned = items.filter(it => it.url.trim());
                const serialized = cleaned.map(it => it.name.trim() ? { url: it.url.trim(), name: it.name.trim() } : it.url.trim());
                setValues((prev) => ({ ...prev, [field.key]: JSON.stringify(serialized) }));
              }}
            />
          ) : field.type === "list" ? (
            <ListField
              key={field.key}
              label={field.label}
              addLabel={field.addLabel}
              placeholder={field.placeholder}
              initial={field.value ? field.value.split("\n").map((s) => s.trim()).filter(Boolean) : [""]}
              onChange={(items) => setValues((prev) => ({ ...prev, [field.key]: items.join("\n") }))}
            />
          ) : field.type === "suggest" ? (
            <SuggestInput
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              suggestions={field.suggestions}
              value={values[field.key] || ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
            />
          ) : (
            <div key={field.key}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type || "text"}
                value={values[field.key] || ""}
                placeholder={field.placeholder}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
              />
            </div>
          )
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save"}
          </button>
          {onDelete && (
            <button onClick={handleDelete} disabled={deleting}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
