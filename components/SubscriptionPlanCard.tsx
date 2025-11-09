
import React, { useState } from 'react';
import { SubscriptionPlan } from '../types';
import { useCredits } from '../hooks/useCredits';
import { supabase } from '../src/integrations/supabase/client';
import Notification from './Notification';

interface SubscriptionPlanCardProps {
    plan: SubscriptionPlan;
    isAdmin: boolean;
    onEdit: () => void;
}

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent-green" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);


const SubscriptionPlanCard: React.FC<SubscriptionPlanCardProps> = ({ plan, isAdmin, onEdit }) => {
    const { subscribeToPlan, userSubscription } = useCredits();
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    const handleSubscribe = async () => {
        if (userSubscription) return;
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setNotification('Please login to subscribe');
                setIsLoading(false);
                return;
            }

            const response = await supabase.functions.invoke('create-stripe-checkout', {
                body: { 
                    type: 'subscription',
                    planId: plan.id
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
            setNotification('Failed to create subscription. Please try again.');
            setIsLoading(false);
            setTimeout(() => setNotification(null), 3000);
        }
    };


    return (
        <div className="relative bg-neutral-800 border border-neutral-700 rounded-xl p-8 flex flex-col">
            {notification && <Notification message={notification} type="success" />}
             {isAdmin && (
                <button onClick={onEdit} className="absolute top-4 right-4 bg-neutral-700 hover:bg-neutral-600 p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
            )}
            <h3 className="text-2xl font-semibold text-white text-center">{plan.name}</h3>
            <div className="mt-4 text-center">
                <span className="text-5xl font-bold tracking-tight text-white">${plan.price.toFixed(2)}</span>
                <span className="text-lg font-medium text-neutral-400">/{plan.currency === 'USD' ? 'mo' : 'mês'}</span>
            </div>
             <p className="text-center text-brand-light mt-2 font-semibold">{plan.credits.toLocaleString('en-US')} credits/month</p>
            
            <ul className="my-8 space-y-3">
                {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                        <CheckIcon />
                        <span className="ml-3 text-neutral-300">{feature}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-auto">
                <button
                    onClick={handleSubscribe}
                    disabled={isLoading || !!userSubscription}
                    className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-secondary hover:bg-brand-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Processing...' : 'Subscribe Now'}
                </button>
            </div>
        </div>
    );
};

export default SubscriptionPlanCard;
