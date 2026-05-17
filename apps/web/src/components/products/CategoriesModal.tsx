'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api, { type CategoryWithCount, type VariationTemplate } from '@/lib/api';

const PRESET_COLORS = [
  '#6366F1', // indigo
  '#3B82F6', // blue
  '#34D399', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
];

interface CategoriesModalProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void; // notify parent to refresh category filter
}

export function CategoriesModal({ open, onClose, onChanged }: CategoriesModalProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New category form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editTemplateId, setEditTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState('');
  const [templates, setTemplates] = useState<VariationTemplate[]>([]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await api.categories.list();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadCategories();
      setError('');
    }
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      setAdding(true);
      await api.categories.create({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
      await loadCategories();
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || PRESET_COLORS[0]);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editingId) return;
    try {
      setSaving(true);
      await api.categories.update(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await loadCategories();
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDelete = async (cat: CategoryWithCount) => {
    if (cat._count.products > 0) {
      setError(`Não é possível excluir: ${cat._count.products} produto(s) usam esta categoria`);
      return;
    }
    if (!confirm(`Excluir categoria "${cat.name}"?`)) return;
    try {
      await api.categories.delete(cat.id);
      await loadCategories();
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Gerenciar Categorias" size="md">
      <div className="space-y-4">
        {/* Error */}
        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Add new category */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-slate-400 text-xs mb-1">Nova Categoria</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da categoria"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex gap-1 items-center">
            {PRESET_COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  newColor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {adding ? '...' : 'Adicionar'}
          </button>
        </div>

        {/* Color picker expanded */}
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${
                newColor === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Category list */}
        <div className="border-t border-slate-800 pt-2">
          {loading ? (
            <div className="text-slate-400 text-sm text-center py-4">Carregando...</div>
          ) : categories.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-4">Nenhuma categoria cadastrada</div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition-colors group"
                >
                  {/* Color dot */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#6366F1' }}
                  />

                  {editingId === cat.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 5).map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${
                              editColor === c ? 'border-white' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-white text-sm">{cat.name}</span>
                      <span className="text-xs text-slate-400">{cat._count.products} produtos</span>
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
