
import React, { useState } from 'react';
import { useCredits } from '../hooks/useCredits';
import { Screen } from '../types';
import CancelSubscriptionModal from '../components/CancelSubscriptionModal';
import Notification from '../components/Notification';

interface ManageSubscriptionProps {
    navigate: (screen: Screen) => void;
}

const ManageSubscription: React.FC<ManageSubscriptionProps> = ({ navigate }) => {
    const { userSubscription } = useCredits();
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    const handleCancelSuccess = () => {
        setNotification('Your subscription has been canceled.');
        setTimeout(() => setNotification(null), 3000);
    }

    if (!userSubscription) {
        return (
            <div className="max-w-2xl mx-auto text-center">
                 <h1 className="text-3xl font-bold text-white mb-6">Manage Subscription</h1>
                 <div className="bg-neutral-800 rounded-lg shadow-lg p-8">
                    <h2 className="text-xl font-semibold text-white">No Active Subscription</h2>
                    <p className="text-neutral-300 mt-2 mb-6">You do not have an active subscription plan. Subscribe to get monthly credits and other benefits!</p>
                    <button 
                        onClick={() => navigate('store')}
                        className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-3 px-6 rounded-lg transition duration-300">
                        View Plans
                    </button>
                 </div>
            </div>
        );
    }

  return (
    <div className="max-w-2xl mx-auto">
      {notification && <Notification message={notification} type="success" />}
      {isCancelModalOpen && <CancelSubscriptionModal onClose={() => setIsCancelModalOpen(false)} onSuccess={handleCancelSuccess} />}
      <h1 className="text-3xl font-bold text-white mb-6">Manage Subscription</h1>
      <div className="bg-neutral-800 rounded-lg shadow-lg p-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">{userSubscription.name} Plan</h2>
            <p className="text-neutral-300">{userSubscription.credits.toLocaleString('en-US')} credits per month.</p>
          </div>
          <span className="text-2xl font-bold text-brand-light">${userSubscription.price}/{userSubscription.currency === 'USD' ? 'mo' : 'mês'}</span>
        </div>
        <div className="border-t border-neutral-700 my-6"></div>
        <div>
          <p className="text-neutral-400">Your subscription will renew on: <span className="text-white font-medium">{new Date(userSubscription.renewsOn).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
          <p className="text-neutral-400 mt-2">Payment method: <span className="text-white font-medium">{userSubscription.paymentMethod}</span></p>
        </div>
        <div className="mt-8">
          <button 
            onClick={() => setIsCancelModalOpen(true)}
            className="w-full bg-accent-red hover:bg-accent-red/90 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
          >
            Cancel Subscription
          </button>
          <p className="text-center text-xs text-neutral-500 mt-4">Cancellation will be effective at the end of the current billing cycle.</p>
        </div>
      </div>
    </div>
  );
};

export default ManageSubscription;
