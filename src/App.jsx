import { useEffect, useState } from 'react'
import { Search, Plus, Trash2, Edit2, X } from 'lucide-react'

function ItemManager() {
  const [items, setItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [password, setPassword] = useState('')
  const [newItem, setNewItem] = useState({ name: '', image: '', description: '' })
  const [editForm, setEditForm] = useState({ name: '', image: '', description: '' })
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await window.storage.get('items-data')
        if (result && result.value) {
          setItems(JSON.parse(result.value))
        }
      } catch (err) {
        console.log('No existing data')
      }
    }
    loadData()
  }, [])

  const saveData = async (data) => {
    try {
      await window.storage.set('items-data', JSON.stringify(data))
    } catch (err) {
      console.error('Save error:', err)
    }
  }

  const handleImageUpload = (event, setter) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Ảnh phải nhỏ hơn 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') {
        setter(result)
        setImageError('')
      }
    }
    reader.onerror = () => setImageError('Không thể đọc file ảnh')
    reader.readAsDataURL(file)
  }

  const handleAdd = () => {
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
    saveData(updatedItems)
    setNewItem({ name: '', image: '', description: '' })
    setImageError('')
    setShowAddForm(false)
    setError('')
  }

  const handleDelete = () => {
    if (password !== '1234') {
      setError('Mật khẩu sai!')
      return
    }

    const updatedItems = items.filter((item) => item.id !== deleteTarget)
    setItems(updatedItems)
    saveData(updatedItems)
    setShowDeleteModal(false)
    setDeleteTarget(null)
    setPassword('')
    setError('')
    setImageError('')
  }

  const handleUpdate = () => {
    const updatedItems = items.map((item) => {
      if (item.id === editTarget) {
        return {
          ...item,
          name: editForm.name.trim() || item.name,
          image: editForm.image.trim() || item.image,
          descriptions: editForm.description.trim()
            ? [...item.descriptions, editForm.description]
            : item.descriptions,
        }
      }
      return item
    })

    setItems(updatedItems)
    saveData(updatedItems)
    setShowEditModal(false)
    setEditTarget(null)
    setEditForm({ name: '', image: '', description: '' })
    setImageError('')
  }

  const filteredItems = items.filter((item) => {
    const searchUpper = searchTerm.toUpperCase()
    const nameMatch = item.name.toUpperCase().includes(searchUpper)
    const descMatch = item.descriptions.some((desc) => desc.toUpperCase().includes(searchUpper))
    return nameMatch || descMatch
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📦 Quản lý Items</h1>
          <p className="text-gray-600">Hệ thống quản lý thông minh với tính năng gộp mô tả</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc mô tả..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 justify-center"
            >
              <Plus size={20} />
              Thêm mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {item.image && <img src={item.image} alt={item.name} className="w-full h-48 object-cover" />}
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name.toUpperCase()}</h3>
                <div className="space-y-2 mb-4">
                  {item.descriptions.map((desc, idx) => (
                    <p key={idx} className="text-gray-600 text-sm bg-gray-50 p-2 rounded">
                      • {desc.toUpperCase()}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditTarget(item.id)
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
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'Không tìm thấy kết quả nào' : 'Chưa có item nào. Hãy thêm mới!'}
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
                    setEditForm({ name: '', image: '', description: '' })
                    setImageError('')
                  }}
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Chỉ điền vào field muốn cập nhật</p>
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
      </div>
    </div>
  )
}

export default ItemManager
