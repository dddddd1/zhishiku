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
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [selectedPersonaDetail, setSelectedPersonaDetail] = useState<Persona | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isNewPersona, setIsNewPersona] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', systemPrompt: '', tone: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [loadingPersonaDetail, setLoadingPersonaDetail] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, []);

  // 当选中角色时加载详情
  useEffect(() => {
    if (selectedPersonaId) {
      loadPersonaDetail(selectedPersonaId);
    } else {
      setSelectedPersonaDetail(null);
    }
  }, [selectedPersonaId]);

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
      // 默认选中第一个
      if (data.personas && data.personas.length > 0 && !selectedPersonaId) {
        setSelectedPersonaId(data.personas[0].id);
      }
    } catch (error) {
      console.error('Failed to load personas:', error);
      showNotification('error', '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadPersonaDetail(roleId: string) {
    if (!roleId) return;
    setLoadingPersonaDetail(true);
    try {
      const res = await fetch(`/api/admin?roleId=${roleId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPersonaDetail(data);
      }
    } catch (error) {
      console.error('Failed to load persona detail:', error);
    } finally {
      setLoadingPersonaDetail(false);
    }
  }

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedPersonaId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roleId', selectedPersonaId);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        showNotification('success', '上传成功！');
        setFile(null);
        loadPersonaDetail(selectedPersonaId); // 刷新详情
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

  async function handleDeleteFile(fileUrl: string) {
    if (!selectedPersonaId) return;

    setDeletingFile(fileUrl);
    try {
      const res = await fetch(`/api/admin?roleId=${selectedPersonaId}&fileUrl=${encodeURIComponent(fileUrl)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showNotification('success', '文件已删除');
        loadPersonaDetail(selectedPersonaId); // 刷新详情
      } else {
        const data = await res.json();
        showNotification('error', `删除失败: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('error', '删除失败');
    } finally {
      setDeletingFile(null);
    }
  }

  async function handleClear(roleId: string, clearVectors: boolean = true) {
    if (!confirm(`确定要${clearVectors ? '清空这个角色的知识库' : '删除这个人设'}吗？`)) return;

    try {
      await fetch(`/api/admin?roleId=${roleId}&clearVectors=${clearVectors}`, {
        method: 'DELETE',
      });
      showNotification('success', '操作成功');
      if (selectedPersonaId === roleId) {
        loadPersonaDetail(roleId); // 刷新详情
      }
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
      <div className="flex h-screen">
        {/* 左侧边栏 - 人设列表 */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              管理后台
            </h1>
            <p className="text-sm text-slate-500 mt-1">人设管理与配置</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => setSelectedPersonaId(persona.id)}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                  selectedPersonaId === persona.id
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-500 shadow-md'
                    : 'hover:bg-slate-50 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate">{persona.name}</h3>
                      {persona.isCustom && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full">
                          自定义
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{persona.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{persona.filesCount || 0} 文件</span>
                      <span>•</span>
                      <span>{persona.tone}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-200">
            <button
              onClick={createNewPersona}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 font-medium shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建人设
            </button>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            {notification && (
              <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 transition-all duration-300 ${
                notification.type === 'success'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
              }`}>
                {notification.message}
              </div>
            )}

            {loadingPersonaDetail ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : selectedPersonaDetail ? (
              <>
                {/* 人设详情卡片 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                        selectedPersonaDetail.id === 'sales-assistant' ? 'bg-blue-100 text-blue-600' :
                        selectedPersonaDetail.id === 'trainer' ? 'bg-purple-100 text-purple-600' :
                        selectedPersonaDetail.id === 'customer-service' ? 'bg-amber-100 text-amber-600' :
                        selectedPersonaDetail.id === 'tech-advisor' ? 'bg-slate-100 text-slate-600' :
                        'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600'
                      }`}>
                        {selectedPersonaDetail.id === 'sales-assistant' ? '🛍️' :
                         selectedPersonaDetail.id === 'trainer' ? '📚' :
                         selectedPersonaDetail.id === 'customer-service' ? '💬' :
                         selectedPersonaDetail.id === 'tech-advisor' ? '⚙️' : '🎭'}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800">{selectedPersonaDetail.name}</h2>
                        <p className="text-slate-500 mt-1">{selectedPersonaDetail.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(selectedPersonaDetail)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        编辑
                      </button>
                      {selectedPersonaDetail.isCustom && (
                        <button
                          onClick={() => handleClear(selectedPersonaDetail.id, false)}
                          className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-200 font-medium shadow-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          删除
                        </button>
                      )}
                      <button
                        onClick={() => handleClear(selectedPersonaDetail.id, true)}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all duration-200 font-medium flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        清空知识库
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="text-sm text-slate-600 mb-1">文件数量</div>
                      <div className="text-2xl font-bold text-blue-600">{selectedPersonaDetail.files?.length || 0}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                      <div className="text-sm text-slate-600 mb-1">语气风格</div>
                      <div className="text-lg font-semibold text-purple-600">{selectedPersonaDetail.tone}</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                      <div className="text-sm text-slate-600 mb-1">类型</div>
                      <div className="text-lg font-semibold text-amber-600">
                        {selectedPersonaDetail.isCustom ? '自定义' : '系统默认'}
                      </div>
                    </div>
                  </div>

                  {selectedPersonaDetail.files && selectedPersonaDetail.files.length > 0 && (
                    <div className="mb-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-700">已上传文件 ({selectedPersonaDetail.files.length})</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                        {Array.isArray(selectedPersonaDetail.files) ? selectedPersonaDetail.files.map((f: string, i: number) => (
                          <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm text-slate-700 truncate" title={decodeURIComponent(f)}>
                                {decodeURIComponent(f.split('/').pop() || f)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteFile(f)}
                              disabled={deletingFile === f}
                              className="ml-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
                              title="删除文件"
                            >
                              {deletingFile === f ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )) : null}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      System Prompt
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                        {selectedPersonaDetail.systemPrompt}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* 上传文件区域 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    上传文件到知识库
                  </h2>
                  <form onSubmit={handleUpload} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">选择文件</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf,.md,.txt,.xlsx,.xls,.docx,.doc"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="file-upload"
                          required
                        />
                        <label
                          htmlFor="file-upload"
                          className="flex items-center justify-center gap-2 w-full px-6 py-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                        >
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <div className="text-center">
                            <span className="text-slate-600 block">
                              {file ? file.name : '点击选择 PDF/MD/TXT 文件'}
                            </span>
                            <span className="text-xs text-slate-400 mt-1 block">
                              将上传到「{selectedPersonaDetail.name}」的知识库
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={uploading || !file}
                      className="w-full px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                          上传文件
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center text-slate-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-lg">请从左侧选择一个人设</p>
                </div>
              </div>
            )}
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
