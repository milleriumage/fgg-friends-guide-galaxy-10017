import React, { useState } from 'react';
import CreditsBadge from './CreditsBadge';
import { Screen } from '../types';
import { useCredits } from '../hooks/useCredits';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import Notification from './Notification';
interface NavbarProps {
  navigate: (screen: Screen) => void;
}

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const Navbar: React.FC<NavbarProps> = ({ navigate }) => {
  const { navbarVisibility, userSubscription } = useCredits();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  console.log('Navbar - userSubscription:', userSubscription);
  console.log('Navbar - navbarVisibility:', navbarVisibility);

  const handleCancelSuccess = () => {
    setShowCancelModal(false);
    setShowPlanModal(false);
    setNotification('Sua assinatura foi cancelada com sucesso.');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <>
      {notification && <Notification message={notification} type="success" />}
    <nav className="flex-shrink-0 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-700">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end h-16">
          <div className="flex items-center space-x-4">
            <CreditsBadge />
            {navbarVisibility.addCreditsButton && (
              <button 
                onClick={() => navigate('store')}
                className="hidden sm:flex items-center bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-2 px-4 rounded-full transition-colors duration-200"
              >
                <PlusIcon />
                Add Credits
              </button>
            )}
            {navbarVisibility.planButton && (
              <button 
                onClick={() => userSubscription ? setShowPlanModal(true) : navigate('store')}
                className="hidden sm:flex items-center bg-neutral-700 hover:bg-neutral-600 text-white font-semibold py-2 px-4 rounded-full transition-colors duration-200"
              >
                {userSubscription ? userSubscription.name : 'Plan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>

      {/* Plan Details Modal */}
      {showPlanModal && userSubscription && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowPlanModal(false)}>
          <div className="bg-neutral-800 rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Seu Plano</h2>
              <button 
                onClick={() => setShowPlanModal(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-neutral-700/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold text-white">{userSubscription.name}</h3>
                  <span className="text-2xl font-bold text-brand-primary">
                    {userSubscription.currency === 'USD' ? '$' : 'R$'}{userSubscription.price.toFixed(2)}/{userSubscription.currency === 'USD' ? 'mês' : 'mês'}
                  </span>
                </div>
                <p className="text-neutral-300">{userSubscription.credits.toLocaleString('pt-BR')} créditos por mês</p>
              </div>

              <div className="border-t border-neutral-700 pt-4">
                <p className="text-neutral-400 text-sm">
                  Renovação em: <span className="text-white font-medium">
                    {new Date(userSubscription.renewsOn).toLocaleDateString('pt-BR', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </p>
                <p className="text-neutral-400 text-sm mt-2">
                  Método de pagamento: <span className="text-white font-medium">{userSubscription.paymentMethod}</span>
                </p>
              </div>

              <button 
                onClick={() => {
                  setShowPlanModal(false);
                  setShowCancelModal(true);
                }}
                className="w-full bg-accent-red hover:bg-accent-red/90 text-white font-bold py-3 px-4 rounded-lg transition duration-300 mt-6"
              >
                Cancelar Assinatura
              </button>
              
              <p className="text-center text-xs text-neutral-500 mt-2">
                O cancelamento será efetivo ao final do período atual.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <CancelSubscriptionModal 
          onClose={() => setShowCancelModal(false)} 
          onSuccess={handleCancelSuccess}
        />
      )}
    </>
  );
};

export default Navbar;
