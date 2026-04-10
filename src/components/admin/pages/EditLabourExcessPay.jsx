import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronDown } from 'lucide-react';
import { getLabourExcessPayById, updateLabourExcessPay } from '../../../api/labourExcessPayApi';
import { getAllLabours } from '../../../api/labourApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const EditLabourExcessPay = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    date: '',
    labourId: '',
    excessHours: '',
    amount: ''
  });
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLabours();
    fetchRecord();
  }, [id]);

  const fetchLabours = async () => {
    try {
      const response = await getAllLabours();
      setLabours(response.data);
    } catch (error) {
      console.error('Error fetching labours:', error);
    }
  };

  const fetchRecord = async () => {
    try {
      const response = await getLabourExcessPayById(id);
      const record = response.data;
      setFormData({
        date: record.date,
        labourId: record.labour_id.toString(),
        excessHours: record.excess_hours.toString(),
        amount: record.amount.toString()
      });
    } catch (error) {
      console.error('Error fetching record:', error);
      alert('Failed to load record');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.labourId) {
      alert('Please select a labour');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await updateLabourExcessPay(id, {
        date: formData.date,
        labour_id: parseInt(formData.labourId),
        excess_hours: parseFloat(formData.excessHours),
        amount: parseFloat(formData.amount)
      });
      alert(response.message || 'Excess pay record updated successfully');
      navigate('/labour/excess-pay');
    } catch (error) {
      console.error('Error updating excess pay record:', error);
      alert(error.message || 'Failed to update excess pay record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/labour/excess-pay')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0D5C4D] mb-1">Edit Excess Pay</h1>
        <p className="text-sm text-[#6B8782]">Update excess pay record</p>
      </div>

      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-[#D0E0DB] p-6 sm:p-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                  required
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={18} />
              </div>
            </div>

            {/* Labour Name */}
            <div>
              <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                Labour Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  name="labourId"
                  value={formData.labourId}
                  onChange={handleInputChange}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                  required
                >
                  <option value="">Select labour</option>
                  {sortDropdownObjects(labours, (labour) => labour.full_name).map(labour => (
                    <option key={labour.lid} value={labour.lid}>
                      {labour.full_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={18} />
              </div>
            </div>

            {/* Excess Hours Worked */}
            <div>
              <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                Excess Hours Worked <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="excessHours"
                value={formData.excessHours}
                onChange={handleInputChange}
                placeholder="Enter excess hours"
                min="0"
                step="0.5"
                className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782] font-medium">₹</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="Enter amount"
                  min="0"
                  step="1"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-6 mt-6 border-t border-[#D0E0DB]">
            <button
              type="button"
              onClick={() => navigate('/labour/excess-pay')}
              className="w-full sm:w-auto px-8 py-2.5 bg-white border border-[#D0E0DB] text-[#0D5C4D] rounded-lg font-medium hover:bg-[#F0F4F3] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-[#0D7C66] hover:bg-[#0a6354] text-white px-8 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLabourExcessPay;
