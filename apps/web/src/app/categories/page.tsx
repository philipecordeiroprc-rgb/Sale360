'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Upload, Package, ChevronDown } from 'lucide-react';
import { ImportModal } from '@/components/ui/ImportModal';
import { IMPORT_CONFIGS } from '@/lib/import-configs';
import api, { type CategoryWithCount, type VariationTemplate } from '@/lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState('');
  const [templates, setTemplates] = useState<VariationTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTemplateId, setEditTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showTemplatesRef, setShowTemplatesRef] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.categories.list();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await api.variationTemplates.list();
      setTemplates(data);
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    loadCategories();
    loadTemplates();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      setAdding(true);
      await api.categories.create({
        name: newName.trim(),
        variationTemplateId: newTemplateId || undefined,
      });
      setNewName('');
      setNewTemplateId('');
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditTemplateId(cat.variationTemplateId || '');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editingId) return;
    try {
      setSaving(true);
      await api.categories.update(editingId, {
        name: editName.trim(),
        variationTemplateId: editTemplateId || null,
      });
      setEditingId(null);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: CategoryWithCount) => {
    if (cat._count.products > 0) {
      setError(`Nao e possivel excluir: ${cat._count.products} produto(s) usam esta categoria`);
      return;
    }
    if (!confirm(`Excluir categoria "${cat.name}"?`)) return;
    try {
      await api.categories.delete(cat.id);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorias</h1>
          <p className="text-slate-400 text-sm mt-0.5">{categories.length} categorias cadastradas</p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <Upload size={16} /> Importar CSV
        </button>
      </div>

      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2 text-red-400 text-sm flex items-center justify-between mb-3">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300"><X size={16} /></button>
        </div>
      )}

      {/* Add new category */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-slate-400 text-xs mb-1">Nova Categoria</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da categoria"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-slate-400 text-xs mb-1">Template de Variação (opcional)</label>
            <select
              value={newTemplateId}
              onChange={(e) => setNewTemplateId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Sem template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {/* Template legend */}
            {newTemplateId && (() => {
              const tpl = templates.find(t => t.id === newTemplateId);
              if (!tpl) return null;
              return (
                <div className="mt-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-1.5">{tpl.name}</p>
                  <div className="space-y-1">
                    {tpl.dimensions?.map((dim, i) => (
                      <p key={i} className="text-[10px] text-slate-400 leading-relaxed">
                        <span className="text-slate-300 font-medium">{dim.label}:</span>{' '}
                        <span className="text-slate-500">{dim.options.join(', ')}</span>
                      </p>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-end"
          >
            <Plus size={16} />
            {adding ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Templates reference panel (collapsible) */}
      {templates.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowTemplatesRef(!showTemplatesRef)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronDown size={12} className={`transition-transform duration-200 ${showTemplatesRef ? 'rotate-0' : '-rotate-90'}`} />
            Templates de Variação disponíveis ({templates.length})
          </button>
          {showTemplatesRef && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {templates.map((tpl) => (
                <div key={tpl.id} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-semibold text-indigo-400 mb-1.5">{tpl.name}</p>
                  <div className="space-y-0.5">
                    {tpl.dimensions?.map((dim, i) => (
                      <p key={i} className="text-[10px] text-slate-400 leading-relaxed">
                        <span className="text-slate-300 font-medium">{dim.label}:</span>{' '}
                        <span className="text-slate-500">{dim.options.join(', ')}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category list */}
      {loading ? (
        <div className="text-slate-400 text-sm text-center py-8">Carregando...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8">
          <Package size={40} className="mx-auto text-slate-600 mb-2" />
          <p className="text-slate-400 mb-2">Nenhuma categoria cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-slate-800/50 transition-colors group"
            >
              {editingId === cat.id ? (
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} disabled={saving} className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <select
                    value={editTemplateId}
                    onChange={(e) => setEditTemplateId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Sem template de variação</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {/* Template legend in edit mode */}
                  {editTemplateId && (() => {
                    const tpl = templates.find(t => t.id === editTemplateId);
                    if (!tpl) return null;
                    return (
                      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-1.5">{tpl.name}</p>
                        <div className="space-y-1">
                          {tpl.dimensions?.map((dim, i) => (
                            <p key={i} className="text-[10px] text-slate-400 leading-relaxed">
                              <span className="text-slate-300 font-medium">{dim.label}:</span>{' '}
                              <span className="text-slate-500">{dim.options.join(', ')}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm block truncate">{cat.name}</span>
                    {cat.variationTemplate && (
                      <span className="text-[10px] text-slate-500 truncate block">{cat.variationTemplate.name}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{cat._count.products} produtos</span>
                  <button onClick={() => handleEdit(cat)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(cat)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { loadCategories(); }}
        config={IMPORT_CONFIGS.categories}
      />
    </div>
  );
}
