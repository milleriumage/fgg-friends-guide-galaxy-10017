import React, { useState, useEffect } from 'react';
import { useCredits } from '../hooks/useCredits';
import { supabase } from '../src/integrations/supabase/client';
import { TransactionType, Screen, SubscriptionPlan, CreditPackage } from '../types';
import Notification from '../components/Notification';
import SubscriptionPlanCard from '../components/SubscriptionPlanCard';
import EditPlanModal from '../components/EditPlanModal';
import EditCreditPackModal from '../components/EditCreditPackModal';

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const Store: React.FC<{ navigate: (screen: Screen) => void; }> = ({ navigate }) => {
    const { addCredits, subscriptionPlans, creditPackages, userSubscription, userRole } = useCredits();
    const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'credits' | 'plans'>('credits');
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [editingCreditPack, setEditingCreditPack] = useState<CreditPackage | null>(null);

    const isDeveloper = userRole === 'developer';

    useEffect(() => {
        // Check for payment status in URL
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const subscriptionStatus = urlParams.get('subscription');

        if (paymentStatus === 'success') {
            setNotification('Payment successful! Your credits have been added.');
            setTimeout(() => setNotification(null), 5000);
            window.history.replaceState({}, '', '/');
        } else if (paymentStatus === 'cancelled') {
            setNotification('Payment cancelled.');
            setTimeout(() => setNotification(null), 3000);
            window.history.replaceState({}, '', '/');
        } else if (subscriptionStatus === 'success') {
            setNotification('Subscription activated successfully!');
            setTimeout(() => setNotification(null), 5000);
            window.history.replaceState({}, '', '/');
        } else if (subscriptionStatus === 'cancelled') {
            setNotification('Subscription cancelled.');
            setTimeout(() => setNotification(null), 3000);
            window.history.replaceState({}, '', '/');
        }
    }, []);

    const handlePurchase = async (pkg: typeof creditPackages[0]) => {
        setLoadingPackage(pkg.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setNotification('Please login to purchase credits');
                setLoadingPackage(null);
                return;
            }

            const response = await supabase.functions.invoke('create-stripe-checkout', {
                body: { 
                    type: 'credit_package',
                    packageId: pkg.id
                }
            });

            if (response.error) {
                throw response.error;
            }

            // Redirect to Stripe Checkout
            if (response.data?.url) {
                window.location.href = response.data.url;
            }
        } catch (error) {
            console.error("Failed to create Stripe checkout", error);
            setNotification('Failed to create payment session. Please try again.');
            setLoadingPackage(null);
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const TabButton: React.FC<{tab: 'credits' | 'plans', label: string}> = ({tab, label}) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-lg font-semibold rounded-t-lg transition-colors ${activeTab === tab ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
        >
            {label}
        </button>
    );

  return (
    <div className="max-w-4xl mx-auto">
      {notification && <Notification message={notification} type="success" />}
      {editingPlan && <EditPlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} />}
      {editingCreditPack && <EditCreditPackModal creditPackage={editingCreditPack} onClose={() => setEditingCreditPack(null)} />}


      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-white sm:text-5xl">Store</h1>
        <p className="mt-4 text-xl text-neutral-300">Choose the best option for you and enjoy the content.</p>
      </div>

      <div className="border-b border-neutral-700 mb-8">
        <div className="flex">
            <TabButton tab="credits" label="Credit Packs" />
            <TabButton tab="plans" label="Subscription Plans" />
        </div>
      </div>

      {activeTab === 'credits' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {creditPackages.map(pkg => (
              <div key={pkg.id} className={`relative rounded-xl p-8 border ${pkg.bestValue ? 'border-brand-primary bg-neutral-800 shadow-lg shadow-brand-primary/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                {isDeveloper && (
                    <button onClick={() => setEditingCreditPack(pkg)} className="absolute top-4 right-4 bg-neutral-700 hover:bg-neutral-600 p-2 rounded-full z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                )}
                {pkg.bestValue && (
                    <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center px-4 py-1 text-sm font-semibold text-white bg-brand-primary rounded-full">BEST VALUE</span>
                    </div>
                )}
                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-white">{pkg.credits.toLocaleString('en-US')} Credits</h3>
                  {pkg.bonus > 0 && <p className="text-brand-light mt-1">+ {pkg.bonus.toLocaleString('en-US')} Bonus!</p>}
                  <p className="mt-6 text-5xl font-bold tracking-tight text-white">${pkg.price.toFixed(2)}</p>
                  
                  <button
                    onClick={() => handlePurchase(pkg)}
                    disabled={!!loadingPackage}
                    className={`mt-8 w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 transition duration-150 ease-in-out ${
                        pkg.bestValue 
                        ? 'bg-brand-primary hover:bg-brand-primary/90' 
                        : 'bg-neutral-700 hover:bg-neutral-600'
                    } ${loadingPackage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {loadingPackage === pkg.id ? 'Processing...' : 'Buy Now'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {activeTab === 'plans' && (
         <div>
            {userSubscription && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg mb-8 text-center">
                    <p>You are currently subscribed to the <span className="font-bold">{userSubscription.name}</span> plan. </p>
                    <p>Please <button onClick={() => navigate('manage-subscription')} className="font-bold underline hover:text-white">cancel your current plan</button> to subscribe to a new one.</p>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {subscriptionPlans.map(plan => (
                    <SubscriptionPlanCard 
                        key={plan.id}
                        plan={plan}
                        isAdmin={isDeveloper}
                        onEdit={() => setEditingPlan(plan)}
                    />
                ))}
            </div>
         </div>
      )}

      <div className="mt-12 text-center text-neutral-400">
        <p className="flex items-center justify-center"><CheckIcon /> Secure payments via Stripe.</p>
        <p className="flex items-center justify-center mt-2"><CheckIcon /> Credits are added instantly.</p>
      </div>
    </div>
  );
};

export default Store;