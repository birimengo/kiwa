import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, ShoppingBag, Home, Download, ArrowRight } from 'lucide-react';

const OrderSuccess = () => {
  const location = useLocation();
  const { orderId, orderNumber, totalAmount } = location.state || {};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Order steps data
  const orderSteps = [
    {
      step: 1,
      title: 'Order Confirmation',
      description: 'You will receive an order confirmation email shortly.'
    },
    {
      step: 2,
      title: 'Order Processing',
      description: 'We\'ll prepare your items for shipping.'
    },
    {
      step: 3,
      title: 'Delivery',
      description: 'Your order will be delivered within 2-3 business days.'
    }
  ];

  return (
    <div className="min-h-screen theme-bg py-4 sm:py-8">
      <div className="max-w-2xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Success Card */}
        <div className="theme-surface rounded-xl shadow-lg theme-border border overflow-hidden">
          
          {/* Header Section */}
          <div className="p-4 sm:p-6 border-b theme-border text-center">
            <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 mx-auto mb-3 sm:mb-4" />
            <h1 className="text-xl sm:text-3xl font-bold theme-text mb-2">
              Order Placed Successfully!
            </h1>
            <p className="theme-text-muted text-sm sm:text-base">
              Thank you for your order. We've received your order and will begin processing it right away.
            </p>
          </div>

          <div className="p-4 sm:p-6">
            {/* Order Details */}
            <div className="theme-secondary rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold theme-text mb-3 sm:mb-4">Order Details</h2>
              
              {orderNumber && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <p className="text-xs sm:text-sm theme-text-muted">Order Number</p>
                    <p className="font-bold theme-text text-base sm:text-lg">{orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm theme-text-muted">Order ID</p>
                    <p className="font-bold theme-text text-sm sm:text-base truncate">{orderId}</p>
                  </div>
                </div>
              )}

              {totalAmount && (
                <div className="border-t theme-border pt-3 sm:pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-base sm:text-lg font-bold theme-text">Total Amount</span>
                    <span className="text-lg sm:text-xl font-bold theme-text">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Next Steps */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold theme-text mb-3">What happens next?</h3>
              <div className="space-y-2 sm:space-y-3">
                {orderSteps.map((step) => (
                  <div key={step.step} className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold mt-0.5 flex-shrink-0">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium theme-text text-sm sm:text-base">{step.title}</p>
                      <p className="theme-text-muted text-xs sm:text-sm">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Support */}
            <div className="theme-secondary rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="theme-text text-xs sm:text-sm text-center">
                <strong>Need help?</strong> Contact our support at{' '}
                <a href="tel:+256700000000" className="theme-primary-text hover:underline">
                  +256 700 000 000
                </a>{' '}
                or{' '}
                <a href="mailto:support@kiwa.com" className="theme-primary-text hover:underline">
                  support@kiwa.com
                </a>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 sm:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                Print Receipt
              </button>
              <Link
                to="/my-orders"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 sm:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4" />
                View Orders
              </Link>
            </div>

            {/* Continue Shopping Button */}
            <Link
              to="/"
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 sm:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base mb-3 sm:mb-4"
            >
              <Home className="h-3 w-3 sm:h-4 sm:w-4" />
              Continue Shopping
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>

            {/* Quick Links */}
            <div className="text-center">
              <p className="theme-text-muted text-xs sm:text-sm">
                Track your order in{' '}
                <Link to="/my-orders" className="theme-primary-text hover:underline font-medium">
                  order history
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .theme-surface, .theme-surface * {
            visibility: visible;
          }
          .theme-surface {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none;
            border: 2px solid #000;
          }
          .no-print {
            display: none !important;
          }
          .theme-text {
            color: #000 !important;
          }
          .theme-text-muted {
            color: #666 !important;
          }
          .theme-secondary {
            background-color: #f8f9fa !important;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderSuccess;