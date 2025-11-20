import { useEffect, useRef, useState } from 'react'
import { Search, Plus, Trash2, Edit2, X, RefreshCw } from 'lucide-react'

const JSONBIN_ID = '691d7274d0ea881f40f1a480'
const JSONBIN_BASE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`

// Google Auth config
const GOOGLE_CLIENT_ID =
  '252253664487-rpl21v12inf0msdr5b1o8kqrt846ut2u.apps.googleusercontent.com'
const ADMIN_EMAILS = new Set(['thanhdcnb6@gmail.com', 'xuanvan.duong2001@gmail.com'])

const extractEnvValue = (rawText, key) => {
  if (typeof rawText !== 'string' || !rawText.trim()) return ''
  const regex = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm')
  const match = rawText.match(regex)
  return match?.[1]?.trim() || ''
}

// Giải mã JWT trả về từ Google để lấy email, tên, avatar
const decodeJwt = (token) => {
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64)
    return JSON.parse(decoded)
  } catch (err) {
    console.error('Không thể decode JWT từ Google:', err)
    return null
  }
}

function ItemManager() {
  const [items, setItems] = useState([])
  const [searchName, setSearchName] = useState('')
  const [searchDescription, setSearchDescription] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [password, setPassword] = useState('')
  const [newItem, setNewItem] = useState({ name: '', image: '', description: '' })
  const [editForm, setEditForm] = useState({
    name: '',
    image: '',
    description: '',
    existingDescriptions: [],
  })
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [jsonBinKey, setJsonBinKey] = useState(import.meta?.env?.VITE_JSONBIN_KEY || '')
  const [previewImage, setPreviewImage] = useState(null)
  const [user, setUser] = useState(null)
  const [googleReady, setGoogleReady] = useState(false)
  const googleButtonRef = useRef(null)

  const isAdmin = user?.email ? ADMIN_EMAILS.has(user.email) : false

  // Google Auth: load script + init
  useEffect(() => {
    // Khôi phục user từ localStorage
    const stored = localStorage.getItem('tools_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('tools_user')
      }
    }

    const handleCredentialResponse = (response) => {
      const data = decodeJwt(response.credential)
      if (!data?.email) {
        setError('Đăng nhập Google thất bại. Vui lòng thử lại.')
        return
      }
      const newUser = {
        email: data.email,
        name: data.name || data.email,
        picture: data.picture || '',
      }
      setUser(newUser)
      localStorage.setItem('tools_user', JSON.stringify(newUser))
      setError('')
    }

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return
      setGoogleReady(true)
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      })
    }

    // Tự động load script Google nếu chưa có
    if (!document.querySelector('script[data-google-identity]')) {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.googleIdentity = 'true'
      script.onload = initGoogle
      document.body.appendChild(script)
    } else {
      initGoogle()
    }
  }, [])

  // Render lại nút Google mỗi khi user đăng xuất & script đã sẵn sàng
  useEffect(() => {
    if (!googleReady || user || !window.google?.accounts?.id) return
    if (!googleButtonRef.current) return
    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'filled_blue',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      width: 280,
      logo_alignment: 'left',
    })
    window.google.accounts.id.prompt()
  }, [googleReady, user])

  const handleLogout = () => {
    if (user?.email && window.google?.accounts?.id?.revoke) {
      window.google.accounts.id.revoke(user.email, () => {
        // eslint-disable-next-line no-console
        console.log('Revoked Google session for', user.email)
      })
    }
    setUser(null)
    localStorage.removeItem('tools_user')
  }

  useEffect(() => {
    const init = async () => {
      if (!jsonBinKey) {
        try {
          const response = await fetch('/bin.env', { cache: 'no-store' })
          if (response.ok) {
            const text = await response.text()
            const extracted = extractEnvValue(text, 'VITE_JSONBIN_KEY')
            if (extracted) {
              setJsonBinKey(extracted)
            }
          }
        } catch (err) {
          console.error('Không thể đọc bin.env:', err)
        }
      }
      loadFromJsonBin()
    }
    init()
  }, [jsonBinKey])

  const loadFromJsonBin = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch(`${JSONBIN_BASE_URL}/latest`, {
        headers: {
          ...(jsonBinKey ? { 'X-Master-Key': jsonBinKey } : {}),
          'X-Bin-Meta': 'false',
        },
      })
      if (response.status === 404) {
        // bin chưa có dữ liệu, giữ danh sách rỗng
        setItems([])
        setSyncError('')
        return
      }
      if (!response.ok) {
        throw new Error(`JSONBin load failed: ${response.status}`)
      }
      const remoteData = await response.json()
      const remoteItems = Array.isArray(remoteData?.items) ? remoteData.items : remoteData?.record?.items
      if (Array.isArray(remoteItems)) {
        setItems(remoteItems)
      }
      setSyncError('')
    } catch (err) {
      console.error('JSONBin fetch error:', err)
      setSyncError('Không thể tải dữ liệu từ JSONBin. Vui lòng kiểm tra kết nối hoặc khóa truy cập.')
    } finally {
      setIsSyncing(false)
    }
  }

  const syncToJsonBin = async (dataToSync) => {
    if (!jsonBinKey) {
      setSyncError('Chưa cấu hình JSONBin key (VITE_JSONBIN_KEY hoặc bin.env). Không thể đồng bộ.')
      return
    }
    setIsSyncing(true)
    try {
      const response = await fetch(JSONBIN_BASE_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(jsonBinKey ? { 'X-Master-Key': jsonBinKey } : {}),
        },
        body: JSON.stringify({ items: dataToSync.map((item) => ({ ...item })) }),
      })
      if (!response.ok) {
        throw new Error(`JSONBin save failed: ${response.status}`)
      }
      setSyncError('')
    } catch (err) {
      console.error('JSONBin sync error:', err)
      setSyncError('Không thể đồng bộ với JSONBin. Vui lòng thử lại.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleImageUpload = async (event, setter) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Ảnh phải nhỏ hơn 5MB')
      return
    }
    setIsUploadingImage(true)
    setImageError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', 'my_tools')

      const response = await fetch('https://api.cloudinary.com/v1_1/dkuxrphfh/image/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || 'Upload thất bại')
      }

      if (typeof data.secure_url === 'string') {
        setter(data.secure_url)
      } else {
        throw new Error('Cloudinary không trả về URL hợp lệ')
      }
    } catch (err) {
      console.error('Cloudinary upload error:', err)
      setImageError('Không thể tải ảnh lên Cloudinary, vui lòng thử lại')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleAdd = () => {
    if (!isAdmin) {
      setError('Bạn không có quyền thêm Item.')
      return
    }
    if (!newItem.name.trim() || !newItem.description.trim()) {
      setError('Tên và mô tả không được để trống!')
      return
    }

    const upperName = newItem.name.toUpperCase()
    const existingIndex = items.findIndex((item) => item.name.toUpperCase() === upperName)

    let updatedItems
    if (existingIndex >= 0) {
      updatedItems = [...items]
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        descriptions: [...updatedItems[existingIndex].descriptions, newItem.description],
      }
    } else {
      updatedItems = [
        ...items,
        {
          id: Date.now(),
          name: newItem.name,
          image: newItem.image,
          descriptions: [newItem.description],
        },
      ]
    }

    setItems(updatedItems)
    syncToJsonBin(
      updatedItems.map((item) => ({
        ...item,
        descriptions: item.descriptions,
      }))
    )
    setNewItem({ name: '', image: '', description: '' })
    setImageError('')
    setShowAddForm(false)
    setError('')
  }

  const handleDelete = () => {
    if (!isAdmin) {
      setError('Bạn không có quyền xóa Item.')
      return
    }
    if (password !== '11102001') {
      setError('Mật khẩu sai!')
      return
    }

    const updatedItems = items.filter((item) => item.id !== deleteTarget)
    setItems(updatedItems)
    syncToJsonBin(updatedItems)
    setShowDeleteModal(false)
    setDeleteTarget(null)
    setPassword('')
    setError('')
    setImageError('')
  }

  const handleUpdate = () => {
    if (!isAdmin) {
      setError('Bạn không có quyền cập nhật Item.')
      return
    }
    const updatedItems = items.map((item) => {
      if (item.id === editTarget) {
        // Chuẩn hóa danh sách mô tả đã được chỉnh sửa trực tiếp
        const editedDescriptions =
          Array.isArray(editForm.existingDescriptions) && editForm.existingDescriptions.length > 0
            ? editForm.existingDescriptions
                .map((d) => d?.trim())
                .filter((d) => d)
            : item.descriptions

        // Nếu người dùng nhập mô tả mới, sẽ thêm vào cuối danh sách
        const finalDescriptions = editForm.description.trim()
          ? [...editedDescriptions, editForm.description.trim()]
          : editedDescriptions

        return {
          ...item,
          name: editForm.name.trim() || item.name,
          image: editForm.image.trim() || item.image,
          descriptions: finalDescriptions,
        }
      }
      return item
    })

    setItems(updatedItems)
    syncToJsonBin(updatedItems)
    setShowEditModal(false)
    setEditTarget(null)
    setEditForm({ name: '', image: '', description: '', existingDescriptions: [] })
    setImageError('')
  }

  const filteredItems = items.filter((item) => {
    const nameQuery = searchName.trim().toUpperCase()
    const descQuery = searchDescription.trim().toUpperCase()

    const nameMatch = nameQuery ? item.name.toUpperCase().includes(nameQuery) : true
    const descMatch = descQuery
      ? item.descriptions.some((desc) => desc.toUpperCase().includes(descQuery))
      : true

    return nameMatch && descMatch
  })
  const isFiltering = Boolean(searchName.trim() || searchDescription.trim())

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📦 Quản lý Items</h1>
          <p className="text-gray-600">
            Hệ thống quản lý thông minh với tính năng gộp mô tả & phân quyền qua Google
          </p>
          <div className="flex flex-col items-center gap-2 mt-4">
            {isSyncing && (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang đồng bộ với JSONBin...</span>
              </div>
            )}
            {syncError && <div className="text-red-500 text-sm">{syncError}</div>}
          </div>
        </div>

        <div className="flex justify-between items-center mb-6 flex-col gap-3 md:flex-row">
          <div className="text-sm text-gray-600">
            {user ? (
              <span>
                Đang đăng nhập: <span className="font-semibold">{user.name}</span>{' '}
                <span className="text-xs text-gray-500">({user.email})</span>{' '}
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {isAdmin ? 'Quyền: Admin (thêm/sửa/xóa)' : 'Quyền: Xem dữ liệu'}
                </span>
              </span>
            ) : (
              <span>Hãy đăng nhập Google để sử dụng đầy đủ tính năng.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {user && user.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full border object-cover"
              />
            )}
            {user ? (
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
              >
                Đăng xuất
              </button>
            ) : (
              <div
                ref={googleButtonRef}
                className="rounded-full border border-purple-200 bg-white shadow-sm px-4 py-2 flex items-center justify-center"
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo mô tả..."
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 justify-center"
              >
                <Plus size={20} />
                Thêm mới
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-48 object-cover cursor-pointer"
                  onClick={() => setPreviewImage(item.image)}
                />
              )}
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name.toUpperCase()}</h3>
                <div className="space-y-2 mb-4">
                  {item.descriptions.map((desc, idx) => (
                    <p key={idx} className="text-gray-600 text-sm bg-gray-50 p-2 rounded">
                      • {desc.toUpperCase()}
                    </p>
                  ))}
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditTarget(item.id)
                        setEditForm({
                          name: item.name,
                          image: item.image || '',
                          description: '',
                          existingDescriptions: item.descriptions,
                        })
                        setShowEditModal(true)
                      }}
                      className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                    >
                      <Edit2 size={16} />
                      Sửa
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget(item.id)
                        setShowDeleteModal(true)
                      }}
                      className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Xóa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {isFiltering
              ? 'Không tìm thấy kết quả nào'
              : isAdmin
              ? 'Chưa có item nào. Hãy thêm mới!'
              : 'Không có item nào để hiển thị.'}
          </div>
        )}

        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Thêm Item Mới</h2>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setError('')
                    setImageError('')
                  }}
                >
                  <X size={24} />
                </button>
              </div>
              {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
              {isUploadingImage && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4">Đang tải ảnh lên Cloudinary...</div>}
              {imageError && <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">{imageError}</div>}
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Tên *"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <label className="block">
                  <span className="text-sm text-gray-600">Ảnh (tối đa 5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (image) => setNewItem((prev) => ({ ...prev, image })))}
                    className="w-full p-2 border rounded mt-1"
                  />
                </label>
                <textarea
                  placeholder="Mô tả *"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full p-2 border rounded h-24"
                />
                <button onClick={handleAdd} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700">
                  Thêm
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Xác nhận xóa</h2>
              {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
              <p className="mb-4">Nhập mật khẩu để xóa:</p>
              <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setPassword('')
                    setError('')
                  }}
                  className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
                >
                  Hủy
                </button>
                <button onClick={handleDelete} className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Cập nhật Item</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditForm({ name: '', image: '', description: '', existingDescriptions: [] })
                    setImageError('')
                  }}
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Chỉ điền vào field muốn cập nhật</p>
              {(editForm.image || editForm.name) && (
                <div className="mb-4 border rounded p-3 bg-gray-50">
                  {editForm.image && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Ảnh hiện tại (bấm để xem lớn)</p>
                      <img
                        src={editForm.image}
                        alt={editForm.name}
                        className="w-full h-40 object-cover rounded cursor-pointer"
                        onClick={() => setPreviewImage(editForm.image)}
                      />
                    </div>
                  )}
                  {Array.isArray(editForm.existingDescriptions) && editForm.existingDescriptions.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Các mô tả (có thể sửa trực tiếp)</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {editForm.existingDescriptions.map((desc, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={desc}
                            onChange={(e) => {
                              const updated = [...editForm.existingDescriptions]
                              updated[idx] = e.target.value
                              setEditForm({ ...editForm, existingDescriptions: updated })
                            }}
                            className="w-full text-xs text-gray-700 bg-white border rounded px-2 py-1"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isUploadingImage && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4">Đang tải ảnh lên Cloudinary...</div>}
              {imageError && <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">{imageError}</div>}
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Tên mới (để trống = giữ nguyên)"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <label className="block">
                  <span className="text-sm text-gray-600">Ảnh mới (để trống = giữ nguyên)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (image) => setEditForm((prev) => ({ ...prev, image })))}
                    className="w-full p-2 border rounded mt-1"
                  />
                </label>
                <textarea
                  placeholder="Mô tả mới (sẽ thêm vào danh sách)"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2 border rounded h-24"
                />
                <button onClick={handleUpdate} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        )}
        {previewImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-5xl max-h-[90vh]">
              <button
                className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewImage(null)
                }}
              >
                <X size={20} />
              </button>
              <img
                src={previewImage}
                alt="Xem ảnh lớn"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-lg bg-black"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ItemManager
