import React, { useState, useEffect } from 'react';
import { updateInventory, deleteInventory } from '../../../api/inventoryApi';
import { getAllCompanies } from '../../../api/inventoryCompanyApi';
import { sortDropdownStrings } from '../../../utils/dropdownSort';

const EditInventory = ({ item, onClose, onUpdate, onDelete }) => {
  const [formData, setFormData] = useState({
    id: item.id,
    name: item.name,
    category: item.category,
    weight: item.weight,
    unit: item.unit,
    color: item.color || '',
    price: item.price || ''
  });

  const [errors, setErrors] = useState({});
  const [companies, setCompanies] = useState([]);

  const categories = ['Boxes', 'Bags', 'Tape', 'Paper', 'Plastic Covers'];
  const units = ['kg', 'm', 'pcs', 'ltr'];

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await getAllCompanies();
      setCompanies(response.data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (formData.category === 'Tape') {
      if (!formData.color.trim()) newErrors.color = 'Color is required for tape';
    } else {
      if (formData.weight === '' || formData.weight < 0) newErrors.weight = 'Valid weight/quantity is required';
      if (!formData.unit) newErrors.unit = 'Unit type is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length === 0) {
      try {
        const itemData = {
          name: formData.name,
          category: formData.category,
          weight: formData.category === 'Tape' ? null : parseFloat(formData.weight),
          unit: formData.category === 'Tape' ? null : formData.unit,
          color: formData.category === 'Tape' ? formData.color : null,
          price: formData.price ? parseFloat(formData.price) : null
        };

        await updateInventory(item.id, itemData);
        onUpdate();
        onClose();
      } catch (error) {
        console.error('Error updating inventory:', error);
        alert('Failed to update inventory item');
      }
    } else {
      setErrors(newErrors);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteInventory(item.id);
        onDelete(item.id);
        onClose();
      } catch (error) {
        console.error('Error deleting inventory:', error);
        alert('Failed to delete inventory item');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-emerald-700">Edit Inventory Item</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 border ${errors.name ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 border ${errors.category ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm appearance-none bg-white cursor-pointer text-gray-900`}
                >
                  {sortDropdownStrings(categories).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {errors.category && (
                <p className="mt-1 text-xs text-red-500">{errors.category}</p>
              )}
            </div>

            {/* Color field for Tape */}
            {formData.category === 'Tape' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="Enter color"
                  className={`w-full px-4 py-2.5 border ${errors.color ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm`}
                />
                {errors.color && (
                  <p className="mt-1 text-xs text-red-500">{errors.color}</p>
                )}
              </div>
            )}

            {/* Weight/Quantity and Unit Type - Hidden for Tape */}
            {formData.category !== 'Tape' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight/Quantity per Unit
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-2.5 border ${errors.weight ? 'border-red-500' : 'border-gray-300'
                      } rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm`}
                  />
                  {errors.weight && (
                    <p className="mt-1 text-xs text-red-500">{errors.weight}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit Type
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 border ${errors.unit ? 'border-red-500' : 'border-gray-300'
                        } rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm appearance-none bg-white cursor-pointer text-gray-900`}
                    >
                      {sortDropdownStrings(units).map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <svg
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {errors.unit && (
                    <p className="mt-1 text-xs text-red-500">{errors.unit}</p>
                  )}
                </div>
              </div>
            )}

            {/* Price field for all categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="Enter price"
                min="0"
                step="0.01"
                className={`w-full px-4 py-2.5 border ${errors.price ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm`}
              />
              {errors.price && (
                <p className="mt-1 text-xs text-red-500">{errors.price}</p>
              )}
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
            >
              Update Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditInventory;