'use client';

import { useState, useEffect } from 'react';

interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tone: string;
  filesCount?: number;
  files?: string[];
  isCustom?: boolean;
}

export default function AdminPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isNewPersona, setIsNewPersona] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', systemPrompt: '', tone: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadPersonas();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  async function loadPersonas() {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setPersonas(data.personas || []);
    } catch (error) {
      console.error('Failed to load personas:', error);
      showNotification('error', '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedRole) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roleId', selectedRole);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        showNotification('success', '上传成功！');
        setFile(null);
        loadPersonas();
      } else {
        const data = await res.json();
        showNotification('error', `上传失败: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('error', '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleClear(roleId: string, clearVectors: boolean = true) {
    if (!confirm(`确定要${clearVectors ? '清空这个角色的知识库' : '删除这个人设'}吗？`)) return;

    try {
      await fetch(`/api/admin?roleId=${roleId}&clearVectors=${clearVectors}`, {
        method: 'DELETE',
      });
      showNotification('success', '操作成功');
      loadPersonas();
    } catch (error) {
      console.error('Clear error:', error);
      showNotification('error', '操作失败');
    }
  }

  function openEditModal(persona: Persona) {
    setEditingPersona(persona);
    setIsNewPersona(false);
    setEditForm({
      name: persona.name,
      description: persona.description,
      systemPrompt: persona.systemPrompt,
      tone: persona.tone,
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPersona) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPersona.id,
          ...editForm,
        }),
      });

      if (res.ok) {
        showNotification('success', '保存成功！');
        setShowEditModal(false);
        loadPersonas();
      } else {
        const data = await res.json();
        showNotification('error', `保存失败: ${data.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      showNotification('error', '保存失败');
    }
  }

  async function createNewPersona() {
    const id = prompt('请输入新人设 ID（英文，唯一）:');
    if (!id) return;

    const name = prompt('请输入人设名称:');
    if (!name) return;

    setEditingPersona({ id, name, description: '', systemPrompt: '', tone: '' });
    setIsNewPersona(true);
    setEditForm({ name, description: '', systemPrompt: '', tone: '' });
    setShowEditModal(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              管理后台
            </h1>
            <p className="text-slate-500 mt-1">人设管理与知识库配置</p>
          </div>
          <button
            onClick={createNewPersona}
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 font-medium shadow-lg shadow-green-500/25 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建人设
          </button>
        </div>

        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
              : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
          }`}>
            {notification.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    persona.id === 'sales-assistant' ? 'bg-blue-100 text-blue-600' :
                    persona.id === 'trainer' ? 'bg-purple-100 text-purple-600' :
                    persona.id === 'customer-service' ? 'bg-amber-100 text-amber-600' :
                    persona.id === 'tech-advisor' ? 'bg-slate-100 text-slate-600' :
                    'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600'
                  }`}>
                    {persona.id === 'sales-assistant' ? '🛍️' :
                     persona.id === 'trainer' ? '📚' :
                     persona.id === 'customer-service' ? '💬' :
                     persona.id === 'tech-advisor' ? '⚙️' : '🎭'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-slate-800">{persona.name}</h3>
                    <p className="text-sm text-slate-500">{persona.description}</p>
                  </div>
                </div>
                {persona.isCustom && (
                  <span className="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full font-medium">
                    自定义
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{persona.filesCount || 0} 个文件</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span>{persona.tone}</span>
                </div>
              </div>

              {persona.files && persona.files.length > 0 && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-2 font-medium">已上传文件:</p>
                  <div className="flex flex-wrap gap-2">
                    {persona.files.map((f, i) => (
                      <span key={i} className="px-2 py-1 bg-white rounded-lg text-xs text-slate-600 border border-slate-200 truncate max-w-[200px]">
                        {f.split('/').pop()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(persona)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-sm"
                >
                  编辑
                </button>
                {persona.isCustom && (
                  <button
                    onClick={() => handleClear(persona.id, false)}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-200 font-medium shadow-sm"
                  >
                    删除
                  </button>
                )}
                <button
                  onClick={() => handleClear(persona.id, true)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium"
                >
                  清空
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            上传文件
          </h2>
          <form onSubmit={handleUpload} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">选择人设</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  required
                >
                  <option value="">请选择...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">选择文件</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.md,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                    required
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-slate-600">
                      {file ? file.name : '点击选择 PDF/MD/TXT'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={uploading || !file || !selectedRole}
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  上传中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  上传
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            API 调用示例
          </h2>
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 overflow-x-auto">
            <pre className="text-sm text-slate-300">{`// 聊天 API
POST /api/chat?roleId=sales-assistant&chatId=xxx
Content-Type: application/json

{
  "message": "你好，我想了解产品"
}

// 响应是 SSE 流格式
// 事件: content, sources, done, error`}</pre>
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {isNewPersona ? '新建人设' : '编辑人设'}
            </h2>
            <form onSubmit={handleSaveEdit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ID</label>
                <input
                  type="text"
                  value={editingPersona?.id || ''}
                  disabled
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">名称</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">语气</label>
                  <input
                    type="text"
                    value={editForm.tone}
                    onChange={(e) => setEditForm({ ...editForm, tone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">描述</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">System Prompt</label>
                <textarea
                  value={editForm.systemPrompt}
                  onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-48 font-mono text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all font-medium shadow-lg shadow-blue-500/25"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_PERSONAS: Record<string, { id: string }> = {
  'sales-assistant': { id: 'sales-assistant' },
  'trainer': { id: 'trainer' },
  'customer-service': { id: 'customer-service' },
  'tech-advisor': { id: 'tech-advisor' },
};
