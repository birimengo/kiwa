// server/controllers/wholesalerController.js
const User = require('../models/User');

// @desc    Get all wholesalers (public endpoint)
// @route   GET /api/wholesalers
// @access  Public
exports.getWholesalers = async (req, res) => {
  try {
    const wholesalers = await User.find({ 
      role: 'admin',
      isActive: true 
    })
    .select('name email phone createdAt lastLogin isActive') // ✅ Added isActive field
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: wholesalers.length,
      wholesalers: wholesalers.map(wholesaler => ({
        _id: wholesaler._id,
        name: wholesaler.name,
        email: wholesaler.email,
        phone: wholesaler.phone || '',
        createdAt: wholesaler.createdAt,
        lastLogin: wholesaler.lastLogin,
        memberSince: wholesaler.createdAt,
        isActive: wholesaler.isActive // ✅ Now includes isActive field
      }))
    });
  } catch (error) {
    console.error('❌ Get wholesalers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching wholesalers',
      error: error.message
    });
  }
};