
import React, { createContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { User, Transaction, TransactionType, ContentItem, SubscriptionPlan, UserSubscription, DevSettings, UserRole, CreatorTransaction, UserTimeout, Screen, CreditPackage } from '../types';
import { REWARD_AMOUNT, INITIAL_CONTENT_ITEMS, INITIAL_SUBSCRIPTION_PLANS, INITIAL_CREDIT_PACKAGES, INITIAL_USERS } from '../constants';
import { supabase } from '../src/integrations/supabase/client';

// --- DEFAULT STATES ---
const initialDevSettings: DevSettings = {
  platformCommission: 0.50, // Updated as per request
  creditValueUSD: 0.01, // Updated for more realistic value
  withdrawalCooldownHours: 24,
  maxImagesPerCard: 5,
  maxVideosPerCard: 2,
  commentsEnabled: false,
};

export interface SidebarVisibility {
  store: boolean;
  outfitGenerator: boolean;
  themeGenerator: boolean;
  manageSubscription: boolean;
  earnCredits: boolean;
  createContent: boolean;
  myCreations: boolean;
  creatorPayouts: boolean;
}

export interface NavbarVisibility {
  addCreditsButton: boolean;
  planButton: boolean;
}

const initialSidebarVisibility: SidebarVisibility = {
  store: true,
  outfitGenerator: false,
  themeGenerator: false,
  manageSubscription: true,
  earnCredits: false,
  createContent: true,
  myCreations: true,
  creatorPayouts: true,
};

const initialNavbarVisibility: NavbarVisibility = {
  addCreditsButton: true,
  planButton: true,
};

// --- CONTEXT TYPE ---
interface CreditsContextType {
  // State
  balance: number;
  earnedBalance: number;
  transactions: Transaction[];
  creatorTransactions: CreatorTransaction[];
  contentItems: ContentItem[];
  subscriptionPlans: SubscriptionPlan[];
  creditPackages: CreditPackage[];
  userSubscription: UserSubscription | null;
  subscriptions: Record<string, UserSubscription | null>; // Key is now user ID (string)
  devSettings: DevSettings;
  userRole: UserRole;
  currentScreen: Screen;
  unlockedContentIds: string[]; // Unlocked content for current user
  withdrawalTimeEnd: number;
  
  // User & Social State
  isLoggedIn: boolean;
  currentUser: User | null;
  allUsers: User[];
  activeTagFilter: string | null;
  viewingCreatorId: string | null; // Changed to string

  // Showcase state
  showcasedUserIds: string[]; // Changed to string[]
  setShowcasedUserIds: (userIds: string[]) => void;

  // Theme state
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Sidebar visibility state
  sidebarVisibility: SidebarVisibility;
  updateSidebarVisibility: (updates: Partial<SidebarVisibility>) => void;
  
  // Navbar visibility state
  navbarVisibility: NavbarVisibility;
  updateNavbarVisibility: (updates: Partial<NavbarVisibility>) => void;

  // Actions
  addCredits: (amount: number, description: string, type: TransactionType) => void;
  processPurchase: (item: ContentItem) => Promise<boolean>;
  addReward: () => void;
  addContentItem: (item: ContentItem) => void;
  deleteContent: (itemId: string) => boolean;
  updateSubscriptionPlan: (updatedPlan: SubscriptionPlan) => void;
  updateCreditPackage: (updatedPackage: CreditPackage) => void;
  subscribeToPlan: (plan: SubscriptionPlan) => void; // For current user
  cancelSubscription: () => void; // For current user
  subscribeUserToPlan: (userId: string, plan: SubscriptionPlan) => void; // For dev panel
  cancelUserSubscription: (userId: string) => void; // For dev panel
  addReaction: (itemId: string, emoji: string) => void;
  addLike: (itemId: string) => void;
  incrementShareCount: (itemId: string) => void;
  
  // User & Social Actions
  login: (userId: string) => void;
  logout: () => void;
  registerOrLoginUser: (userId: string, email: string, username?: string) => void;
  updateUserProfile: (updatedProfile: Partial<User>) => void;
  followUser: (userIdToFollow: string) => void;
  unfollowUser: (userIdToUnfollow: string) => void;
  setTagFilter: (tag: string | null) => void;
  setViewCreator: (creatorId: string | null) => void;
  setViewCreatorBySlug: (slug: string) => void;
  shareVitrine: () => void;

  // Role & Screen Management
  setCurrentScreen: (screen: Screen) => void;

  // Dev Actions
  updateDevSettings: (settings: Partial<DevSettings>) => void;
  addCreditsToUser: (userId: string, amount: number) => void;
  toggleContentVisibility: (itemId: string) => void;
  removeContent: (itemId: string) => void;
  setTimeOut: (userId: string, durationHours: number, message: string) => void;
  hideAllContentFromCreator: (creatorId: string) => void;
  deleteAllContentFromCreator: (creatorId: string) => void;

  // Timeout Info
  isTimedOut: (userId: string) => boolean;
  timeoutInfo: (userId: string) => UserTimeout | undefined;
  
  // Withdrawal
  processWithdrawal: () => Promise<boolean>;
}

export const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

// --- PROVIDER COMPONENT ---
export const CreditsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core State
  const [balance, setBalance] = useState(100);
  const [earnedBalances, setEarnedBalances] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creatorTransactions, setCreatorTransactions] = useState<CreatorTransaction[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>(INITIAL_CONTENT_ITEMS);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>(INITIAL_SUBSCRIPTION_PLANS);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>(INITIAL_CREDIT_PACKAGES);
  const [subscriptions, setSubscriptions] = useState({} as Record<string, UserSubscription | null>);
  const [unlockedContentByUser, setUnlockedContentByUser] = useState<Record<string, string[]>>({});
  
  // Role, Dev, and Screen State
  const [devSettings, setDevSettings] = useState<DevSettings>(initialDevSettings);
  const [timeouts, setTimeouts] = useState<Record<string, UserTimeout>>({});
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [withdrawalTimeEnd, setWithdrawalTimeEnd] = useState(0);

  // New User, Auth & Social State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  const [activeTagFilter, setTagFilter] = useState<string | null>(null);
  const [viewingCreatorId, setViewCreatorId] = useState<string | null>(null);

  // New Showcase & Theme State
  const [showcasedUserIds, setShowcasedUserIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [sidebarVisibility, setSidebarVisibility] = useState<SidebarVisibility>(initialSidebarVisibility);
  const [navbarVisibility, setNavbarVisibility] = useState<NavbarVisibility>(initialNavbarVisibility);

  useEffect(() => {
      setWithdrawalTimeEnd(Date.now() + initialDevSettings.withdrawalCooldownHours * 3600 * 1000);
  }, []);
  
  const userSubscription = useMemo(() => {
      if (!currentUser) return null;
      return subscriptions[currentUser.id] || null;
  }, [currentUser, subscriptions]);

  const earnedBalance = useMemo(() => {
    if (!currentUser) return 0;
    return earnedBalances[currentUser.id] || 0;
  }, [currentUser, earnedBalances]);

  const unlockedContentIds = useMemo(() => {
    if (!currentUser) return [];
    return unlockedContentByUser[currentUser.id] || [];
  }, [currentUser, unlockedContentByUser]);


  const registerOrLoginUser = useCallback(async (userId: string, email: string, username?: string) => {
    let user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      // Criar novo usuário se não existir
      user = {
        id: userId,
        username: username || email.split('@')[0],
        email: email,
        profilePictureUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        role: 'user',
        followers: [],
        following: [],
        vitrineSlug: userId,
      };
      setAllUsers(prev => [...prev, user!]);
    }
    
    setCurrentUser(user);
    setIsLoggedIn(true);
    setCurrentScreen('home');
    
      // Load balance and unlocked content from Supabase
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits_balance, earned_balance, last_withdrawal_at')
          .eq('id', userId)
          .single();
        
        if (profile) {
          setBalance(profile.credits_balance);
          setEarnedBalances(prev => ({ ...prev, [userId]: profile.earned_balance }));
          
          // Calculate withdrawal time based on last withdrawal
          if (profile.last_withdrawal_at) {
            const lastWithdrawal = new Date(profile.last_withdrawal_at).getTime();
            const cooldownMs = devSettings.withdrawalCooldownHours * 60 * 60 * 1000;
            const nextWithdrawalTime = lastWithdrawal + cooldownMs;
            setWithdrawalTimeEnd(Math.max(nextWithdrawalTime, Date.now()));
          } else {
            // No withdrawal yet, user can withdraw immediately
            setWithdrawalTimeEnd(Date.now());
          }
        }

        // Load unlocked content for this user
        const { data: unlockedContent } = await supabase
          .from('unlocked_content')
          .select('content_item_id')
          .eq('user_id', userId);
        
        if (unlockedContent) {
          setUnlockedContentByUser(prev => ({
            ...prev,
            [userId]: unlockedContent.map(item => item.content_item_id)
          }));
        }

        // Load user subscription from Supabase
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        
        if (subscription && subscription.subscription_plans) {
          const plan = subscription.subscription_plans as any;
          const userSub: UserSubscription = {
            id: plan.id,
            name: plan.name,
            price: parseFloat(plan.price),
            credits: plan.credits,
            currency: plan.currency || 'USD',
            features: plan.features || [],
            renewsOn: subscription.renews_on,
            paymentMethod: 'Stripe'
          };
          setSubscriptions(prev => ({ ...prev, [userId]: userSub }));
        } else {
          setSubscriptions(prev => ({ ...prev, [userId]: null }));
        }

        // Load all content items from Supabase with media
        const { data: items } = await supabase
          .from('content_items')
          .select(`
            *,
            media (
              id,
              media_type,
              storage_path,
              display_order
            ),
            likes (user_id),
            shares (user_id),
            reactions (user_id, emoji)
          `)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
        
        if (items) {
          const mappedItems: ContentItem[] = items.map(item => {
            const media = (item.media as any[]) || [];
            const likes = (item.likes as any[]) || [];
            const shares = (item.shares as any[]) || [];
            const reactions = (item.reactions as any[]) || [];
            
            // Get first image as thumbnail
            const firstImage = media
              .filter(m => m.media_type === 'image')
              .sort((a, b) => a.display_order - b.display_order)[0];
            
            // Count media types
            const imageCount = media.filter(m => m.media_type === 'image').length;
            const videoCount = media.filter(m => m.media_type === 'video').length;
            
            // Build reactions object
            const userReactions: Record<string, string> = {};
            reactions.forEach(r => {
              userReactions[r.user_id] = r.emoji;
            });
            
            // Use consistent placeholder SVG instead of random images
            const placeholderSVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjgwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0iIzI2MjYyNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
            
            // Extract file path from storage_path (remove user_id/content_id prefix if present)
            const getFilePath = (storagePath: string) => {
              // If storage_path is already a full URL, extract the path
              if (storagePath.includes('content-media/')) {
                return storagePath.split('content-media/')[1];
              }
              return storagePath;
            };
            
            // Get public URL for the full image
            const imageUrl = firstImage?.storage_path 
              ? supabase.storage.from('content-media').getPublicUrl(getFilePath(firstImage.storage_path)).data.publicUrl
              : placeholderSVG;
            
            // Create thumbnail URL with transformation
            const thumbnailUrl = firstImage?.storage_path
              ? `${imageUrl}?width=400&height=600&quality=80`
              : placeholderSVG;
            
            return {
              id: item.id,
              creatorId: item.creator_id,
              title: item.title,
              price: item.price,
              blurLevel: item.blur_level,
              tags: item.tags || [],
              createdAt: item.created_at,
              imageUrl,
              thumbnailUrl,
              likedBy: likes.map(l => l.user_id),
              sharedBy: shares.map(s => s.user_id),
              userReactions,
              mediaCount: { images: imageCount, videos: videoCount }
            };
          });
          setContentItems(mappedItems);
        }
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
      }
  }, [allUsers, devSettings.withdrawalCooldownHours]);

  const login = useCallback(async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      setCurrentScreen('home');
      
      // Load balance and unlocked content from Supabase
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits_balance, earned_balance, last_withdrawal_at')
          .eq('id', userId)
          .single();
        
        if (profile) {
          setBalance(profile.credits_balance);
          setEarnedBalances(prev => ({ ...prev, [userId]: profile.earned_balance }));
          
          // Calculate withdrawal time based on last withdrawal
          if (profile.last_withdrawal_at) {
            const lastWithdrawal = new Date(profile.last_withdrawal_at).getTime();
            const cooldownMs = devSettings.withdrawalCooldownHours * 60 * 60 * 1000;
            const nextWithdrawalTime = lastWithdrawal + cooldownMs;
            setWithdrawalTimeEnd(Math.max(nextWithdrawalTime, Date.now()));
          } else {
            // No withdrawal yet, user can withdraw immediately
            setWithdrawalTimeEnd(Date.now());
          }
        }

        // Load unlocked content for this user
        const { data: unlockedContent } = await supabase
          .from('unlocked_content')
          .select('content_item_id')
          .eq('user_id', userId);
        
        if (unlockedContent) {
          setUnlockedContentByUser(prev => ({
            ...prev,
            [userId]: unlockedContent.map(item => item.content_item_id)
          }));
        }

        // Load user subscription from Supabase
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        
        if (subscription && subscription.subscription_plans) {
          const plan = subscription.subscription_plans as any;
          const userSub: UserSubscription = {
            id: plan.id,
            name: plan.name,
            price: parseFloat(plan.price),
            credits: plan.credits,
            currency: plan.currency || 'USD',
            features: plan.features || [],
            renewsOn: subscription.renews_on,
            paymentMethod: 'Stripe'
          };
          setSubscriptions(prev => ({ ...prev, [userId]: userSub }));
        } else {
          setSubscriptions(prev => ({ ...prev, [userId]: null }));
        }

        // Load all content items from Supabase with media
        const { data: items } = await supabase
          .from('content_items')
          .select(`
            *,
            media (
              id,
              media_type,
              storage_path,
              display_order
            ),
            likes (user_id),
            shares (user_id),
            reactions (user_id, emoji)
          `)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
        
        if (items) {
          const mappedItems: ContentItem[] = items.map(item => {
            const media = (item.media as any[]) || [];
            const likes = (item.likes as any[]) || [];
            const shares = (item.shares as any[]) || [];
            const reactions = (item.reactions as any[]) || [];
            
            // Get first image as thumbnail
            const firstImage = media
              .filter(m => m.media_type === 'image')
              .sort((a, b) => a.display_order - b.display_order)[0];
            
            // Count media types
            const imageCount = media.filter(m => m.media_type === 'image').length;
            const videoCount = media.filter(m => m.media_type === 'video').length;
            
            // Build reactions object
            const userReactions: Record<string, string> = {};
            reactions.forEach(r => {
              userReactions[r.user_id] = r.emoji;
            });
            
            // Use consistent placeholder SVG instead of random images
            const placeholderSVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjgwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0iIzI2MjYyNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
            
            // Extract file path from storage_path (remove user_id/content_id prefix if present)
            const getFilePath = (storagePath: string) => {
              // If storage_path is already a full URL, extract the path
              if (storagePath.includes('content-media/')) {
                return storagePath.split('content-media/')[1];
              }
              return storagePath;
            };
            
            // Get public URL for the full image
            const imageUrl = firstImage?.storage_path 
              ? supabase.storage.from('content-media').getPublicUrl(getFilePath(firstImage.storage_path)).data.publicUrl
              : placeholderSVG;
            
            // Create thumbnail URL with transformation
            const thumbnailUrl = firstImage?.storage_path
              ? `${imageUrl}?width=400&height=600&quality=80`
              : placeholderSVG;
            
            return {
              id: item.id,
              creatorId: item.creator_id,
              title: item.title,
              price: item.price,
              blurLevel: item.blur_level,
              tags: item.tags || [],
              createdAt: item.created_at,
              imageUrl,
              thumbnailUrl,
              likedBy: likes.map(l => l.user_id),
              sharedBy: shares.map(s => s.user_id),
              userReactions,
              mediaCount: { images: imageCount, videos: videoCount }
            };
          });
          setContentItems(mappedItems);
        }
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
      }
    }
  }, [allUsers, devSettings.withdrawalCooldownHours]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setViewCreatorId(null); 
  }, []);
  
  const updateUserProfile = useCallback((updatedProfile: Partial<User>) => {
      if (!currentUser) return;
      const updatedUser = { ...currentUser, ...updatedProfile };
      setCurrentUser(updatedUser);
      setAllUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  }, [currentUser]);

  const followUser = useCallback(async (userIdToFollow: string) => {
    if (!currentUser || currentUser.id === userIdToFollow) return;
    
    setAllUsers(prev => prev.map(user => {
        if (user.id === currentUser.id) {
            return { ...user, following: [...new Set([...user.following, userIdToFollow])] };
        }
        if (user.id === userIdToFollow) {
             return { ...user, followers: [...new Set([...user.followers, currentUser.id])] };
        }
        return user;
    }));
    setCurrentUser(prev => prev ? { ...prev, following: [...new Set([...prev.following, userIdToFollow])] } : null);

    // Save to Supabase
    try {
      await supabase
        .from('followers')
        .insert({ follower_id: currentUser.id, following_id: userIdToFollow });
    } catch (error) {
      console.error('Error saving follow:', error);
    }
  }, [currentUser]);

  const unfollowUser = useCallback(async (userIdToUnfollow: string) => {
     if (!currentUser) return;
     
     setAllUsers(prev => prev.map(user => {
        if (user.id === currentUser.id) {
            return { ...user, following: user.following.filter(id => id !== userIdToUnfollow) };
        }
        if (user.id === userIdToUnfollow) {
            return { ...user, followers: user.followers.filter(id => id !== currentUser.id) };
        }
        return user;
    }));
    setCurrentUser(prev => prev ? { ...prev, following: prev.following.filter(id => id !== userIdToUnfollow) } : null);

    // Save to Supabase
    try {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', userIdToUnfollow);
    } catch (error) {
      console.error('Error removing follow:', error);
    }
  }, [currentUser]);

  const setTagFilterCallback = useCallback((tag: string | null) => {
      setTagFilter(tag);
      setViewCreatorId(null); 
      setCurrentScreen('home');
  }, []);

  const setViewCreatorCallback = useCallback((creatorId: string | null) => {
      setViewCreatorId(creatorId);
      setTagFilter(null); 
      setCurrentScreen(creatorId ? 'view-creator' : 'home');
  }, []);

  const setViewCreatorBySlug = useCallback(async (slug: string) => {
    // Try to find in allUsers first
    let creator = allUsers.find(u => u.vitrineSlug === slug);
    
    // If not found in local state, query Supabase
    if (!creator) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('vitrine_slug', slug)
          .single();
        
        if (profile) {
          // Map Supabase profile to User type
          creator = {
            id: profile.id,
            role: 'creator' as UserRole, // Default to creator for vitrine users
            username: profile.username,
            profilePictureUrl: profile.profile_picture_url || '',
            followers: [], // Will be loaded separately if needed
            following: [], // Will be loaded separately if needed
            email: '', // Not needed for public profile view
            vitrineSlug: profile.vitrine_slug || undefined,
            bio: profile.bio || undefined,
          };
          
          // Add to allUsers
          setAllUsers(prev => {
            const exists = prev.find(u => u.id === creator!.id);
            if (exists) return prev;
            return [...prev, creator!];
          });
        }
      } catch (error) {
        console.error('Error finding creator by slug:', error);
      }
    }
    
    if (creator) {
      setViewCreatorCallback(creator.id);
    }
  }, [allUsers, setViewCreatorCallback]);

  const shareVitrine = useCallback(() => {
    if (!currentUser || !currentUser.vitrineSlug) {
        alert("Could not generate a share link.");
        return;
    }
    const url = `https://funfans.com/vitrine/${currentUser.vitrineSlug}`;
    navigator.clipboard.writeText(url);
    alert(`Link copied to clipboard!\n${url}`);
  }, [currentUser]);

  const addTransaction = (trans: Omit<Transaction, 'id' | 'timestamp'>) => {
     setTransactions(prev => [
      { id: Date.now().toString(), timestamp: new Date().toISOString(), ...trans },
      ...prev,
    ]);
  };

  const addCredits = useCallback(async (amount: number, description: string, type: TransactionType) => {
    setBalance(prev => {
      const newBalance = prev + amount;
      
      // Save to Supabase
      if (currentUser) {
        supabase
          .from('profiles')
          .update({ credits_balance: newBalance })
          .eq('id', currentUser.id)
          .then(({ error }) => {
            if (error) console.error('Error updating credits in Supabase:', error);
          });
      }
      
      return newBalance;
    });
    addTransaction({ type, amount, description });
  }, [currentUser]);

  const processPurchase = useCallback(async (item: ContentItem) => {
    if (!currentUser) return false;
    
    // Prevent creator from purchasing their own content
    if (currentUser.id === item.creatorId) {
      return false;
    }
    
    if (balance >= item.price) {
      const newBalance = balance - item.price;
      setBalance(newBalance);
      
      // Save buyer's balance to Supabase
      try {
        await supabase
          .from('profiles')
          .update({ credits_balance: newBalance })
          .eq('id', currentUser.id);
      } catch (error) {
        console.error('Error updating buyer balance in Supabase:', error);
      }
      
      addTransaction({ type: TransactionType.PURCHASE, amount: -item.price, description: `Purchase of ${item.title}` });

      const earnings = item.price * (1 - devSettings.platformCommission);
      
      setEarnedBalances(prev => ({
          ...prev,
          [item.creatorId]: (prev[item.creatorId] || 0) + earnings
      }));

      // Save creator's earnings to Supabase
      try {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('earned_balance')
          .eq('id', item.creatorId)
          .single();
        
        if (creatorProfile) {
          await supabase
            .from('profiles')
            .update({ earned_balance: creatorProfile.earned_balance + earnings })
            .eq('id', item.creatorId);
        }
      } catch (error) {
        console.error('Error updating creator earnings in Supabase:', error);
      }

      setCreatorTransactions(prev => [
          {
              id: `ctx_${Date.now()}`,
              cardId: item.id,
              cardTitle: item.title,
              buyerId: currentUser.id,
              amountReceived: earnings,
              originalPrice: item.price,
              timestamp: new Date().toISOString(),
              mediaCount: item.mediaCount,
          },
          ...prev
      ]);
      
      // Unlock content for the specific user only
      setUnlockedContentByUser(prev => ({
        ...prev,
        [currentUser.id]: [...(prev[currentUser.id] || []), item.id]
      }));

      // Save to Supabase unlocked_content table
      try {
        await supabase
          .from('unlocked_content')
          .insert({ 
            user_id: currentUser.id, 
            content_item_id: item.id 
          });
      } catch (error) {
        console.error('Error saving unlocked content to Supabase:', error);
      }

      return true;
    }
    return false;
  }, [balance, devSettings.platformCommission, currentUser]);
  
  const addReward = useCallback(() => {
    addCredits(REWARD_AMOUNT, 'Credits from watching ad', TransactionType.REWARD);
  }, [addCredits]);

  const addContentItem = useCallback(async (item: ContentItem) => {
    setContentItems(prev => [item, ...prev]);
    
    // Save to Supabase
    try {
      await supabase
        .from('content_items')
        .insert({
          id: item.id,
          creator_id: item.creatorId,
          title: item.title,
          price: item.price,
          blur_level: item.blurLevel,
          tags: item.tags,
          is_hidden: false
        });
    } catch (error) {
      console.error('Error saving content to Supabase:', error);
    }
  }, []);

  const deleteContent = useCallback((itemId: string): boolean => {
    const item = contentItems.find(i => i.id === itemId);
    if (!item) return false;

    const canDelete = (Date.now() - new Date(item.createdAt).getTime()) > 24 * 60 * 60 * 1000;
    if (canDelete) {
        setContentItems(prev => prev.filter(i => i.id !== itemId));
        return true;
    }
    return false;
  }, [contentItems]);

  const updateSubscriptionPlan = useCallback((updatedPlan: SubscriptionPlan) => {
    setSubscriptionPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  }, []);

   const updateCreditPackage = useCallback((updatedPackage: CreditPackage) => {
    setCreditPackages(prev => prev.map(p => p.id === updatedPackage.id ? updatedPackage : p));
  }, []);

  const subscribeToPlan = useCallback((plan: SubscriptionPlan) => {
    if (!currentUser) return;
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const newSubscription: UserSubscription = {
        ...plan,
        renewsOn: renewalDate.toISOString(),
        paymentMethod: 'Credit Card ending **** 4242'
    };
    setSubscriptions(prev => ({...prev, [currentUser.id]: newSubscription}));
    addCredits(plan.credits, `Subscription credits for ${plan.name} plan`, TransactionType.SUBSCRIPTION);
  }, [addCredits, currentUser]);

  const cancelSubscription = useCallback(async () => {
    if (!userSubscription || !currentUser) return;

    try {
      const { error } = await supabase.functions.invoke('cancel-stripe-subscription');
      
      if (error) {
        console.error('Error canceling subscription:', error);
        throw error;
      }

      // Update local state
      setSubscriptions(prev => ({
        ...prev,
        [currentUser.id]: null
      }));

      addTransaction({ 
        type: TransactionType.SUBSCRIPTION, 
        amount: 0, 
        description: `Canceled ${userSubscription.name} plan` 
      });
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }, [userSubscription, currentUser]);

  const subscribeUserToPlan = useCallback((userId: string, plan: SubscriptionPlan) => {
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const newSubscription: UserSubscription = {
        ...plan,
        renewsOn: renewalDate.toISOString(),
        paymentMethod: 'Admin Assigned'
    };
    
    setSubscriptions(prev => ({...prev, [userId]: newSubscription}));
  }, []);

  const cancelUserSubscription = useCallback((userId: string) => {
    const subToCancel = subscriptions[userId];
    if (subToCancel) {
        addTransaction({ type: TransactionType.SUBSCRIPTION, amount: 0, description: `Admin Canceled ${subToCancel.name} for ${userId}` });
        setSubscriptions(prev => {
            const newSubs = {...prev};
            delete newSubs[userId];
            return newSubs;
        });
    }
  }, [subscriptions]);

  const addReaction = useCallback(async (itemId: string, emoji: string) => {
    if (!currentUser) return;
    
    setContentItems(prev => prev.map(item => {
        if (item.id === itemId) {
            const newUserReactions = { ...item.userReactions };
            if (newUserReactions[currentUser.id] === emoji) {
                 delete newUserReactions[currentUser.id];
            } else {
                newUserReactions[currentUser.id] = emoji;
            }
            return { ...item, userReactions: newUserReactions };
        }
        return item;
    }));

    // Save to Supabase
    try {
      const { data: existingReaction } = await supabase
        .from('reactions')
        .select()
        .eq('content_item_id', itemId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (existingReaction && existingReaction.emoji === emoji) {
        // Remove reaction
        await supabase
          .from('reactions')
          .delete()
          .eq('content_item_id', itemId)
          .eq('user_id', currentUser.id);
      } else if (existingReaction) {
        // Update reaction
        await supabase
          .from('reactions')
          .update({ emoji })
          .eq('content_item_id', itemId)
          .eq('user_id', currentUser.id);
      } else {
        // Insert new reaction
        await supabase
          .from('reactions')
          .insert({ content_item_id: itemId, user_id: currentUser.id, emoji });
      }
    } catch (error) {
      console.error('Error saving reaction:', error);
    }
  }, [currentUser]);

  const addLike = useCallback(async (itemId: string) => {
      if (!currentUser) return;
      
      setContentItems(prev => prev.map(item => {
          if (item.id === itemId) {
              const hasLiked = item.likedBy.includes(currentUser.id);
              const newLikedBy = hasLiked 
                  ? item.likedBy.filter(id => id !== currentUser.id)
                  : [...item.likedBy, currentUser.id];
              return { ...item, likedBy: newLikedBy };
          }
          return item;
      }));

      // Save to Supabase
      try {
        const { data: existingLike } = await supabase
          .from('likes')
          .select()
          .eq('content_item_id', itemId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (existingLike) {
          // Remove like
          await supabase
            .from('likes')
            .delete()
            .eq('content_item_id', itemId)
            .eq('user_id', currentUser.id);
        } else {
          // Add like
          await supabase
            .from('likes')
            .insert({ content_item_id: itemId, user_id: currentUser.id });
        }
      } catch (error) {
        console.error('Error saving like:', error);
      }
  }, [currentUser]);

  const incrementShareCount = useCallback((itemId: string) => {
    if (!currentUser) return;
    setContentItems(prev => prev.map(item => {
        if (item.id === itemId) {
            if (!item.sharedBy.includes(currentUser.id)) {
                return { ...item, sharedBy: [...item.sharedBy, currentUser.id] };
            }
        }
        return item;
    }));
  }, [currentUser]);

  const updateDevSettings = useCallback((settings: Partial<DevSettings>) => {
    setDevSettings(prev => ({...prev, ...settings}));
  }, []);

  const addCreditsToUser = useCallback(async (userId: string, amount: number) => {
      // Update in Supabase first
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits_balance')
          .eq('id', userId)
          .single();
        
        if (profile) {
          const newBalance = profile.credits_balance + amount;
          await supabase
            .from('profiles')
            .update({ credits_balance: newBalance })
            .eq('id', userId);
          
          // If the target user is the current logged-in user, update local state
          if (currentUser?.id === userId) {
            setBalance(newBalance);
            addTransaction({ 
              type: TransactionType.CREDIT_PURCHASE, 
              amount: amount, 
              description: `Admin grant for user ${userId}`
            });
          }
        }
      } catch (error) {
        console.error('Error adding credits to user:', error);
      }
  }, [currentUser]);
  
  const toggleContentVisibility = useCallback((itemId: string) => {
      setContentItems(prev => prev.map(item => item.id === itemId ? {...item, isHidden: !item.isHidden} : item));
  }, []);

  const removeContent = useCallback((itemId: string) => {
      setContentItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const hideAllContentFromCreator = useCallback((creatorId: string) => {
      setContentItems(prev => prev.map(item => item.creatorId === creatorId ? {...item, isHidden: true} : item));
  }, []);

  const deleteAllContentFromCreator = useCallback((creatorId: string) => {
      setContentItems(prev => prev.filter(item => item.creatorId !== creatorId));
  }, []);

  const setTimeOut = useCallback((userId: string, durationHours: number, message: string) => {
      const endTime = Date.now() + durationHours * 60 * 60 * 1000;
      setTimeouts(prev => ({...prev, [userId]: { userId, endTime, message }}));
  }, []);

  const isTimedOut = useCallback((userId: string) => {
      const timeout = timeouts[userId];
      return timeout && Date.now() < timeout.endTime;
  }, [timeouts]);

  const timeoutInfo = useCallback((userId: string) => {
      return timeouts[userId];
  }, [timeouts]);

  const processWithdrawal = useCallback(async () => {
    if (!currentUser) return false;
    
    try {
      const now = new Date().toISOString();
      
      // Update last_withdrawal_at in Supabase
      await supabase
        .from('profiles')
        .update({ last_withdrawal_at: now })
        .eq('id', currentUser.id);
      
      // Calculate next withdrawal time
      const cooldownMs = devSettings.withdrawalCooldownHours * 60 * 60 * 1000;
      const nextWithdrawalTime = Date.now() + cooldownMs;
      setWithdrawalTimeEnd(nextWithdrawalTime);
      
      return true;
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      return false;
    }
  }, [currentUser, devSettings.withdrawalCooldownHours]);

  const updateSidebarVisibility = useCallback((updates: Partial<SidebarVisibility>) => {
    setSidebarVisibility(prev => ({ ...prev, ...updates }));
  }, []);

  const updateNavbarVisibility = useCallback((updates: Partial<NavbarVisibility>) => {
    setNavbarVisibility(prev => ({ ...prev, ...updates }));
  }, []);
  
  const contextValue = useMemo(() => ({
    balance,
    earnedBalance,
    transactions,
    creatorTransactions,
    contentItems: contentItems.filter(item => (currentUser?.role === 'developer' || !item.isHidden)),
    subscriptionPlans,
    creditPackages,
    userSubscription,
    subscriptions,
    devSettings,
    userRole: currentUser?.role ?? 'user',
    currentScreen,
    unlockedContentIds,
    withdrawalTimeEnd,
    isLoggedIn,
    currentUser,
    allUsers,
    activeTagFilter,
    viewingCreatorId,
    showcasedUserIds,
    setShowcasedUserIds,
    theme,
    setTheme,
    addCredits,
    processPurchase,
    addReward,
    addContentItem,
    deleteContent,
    updateSubscriptionPlan,
    updateCreditPackage,
    subscribeToPlan,
    cancelSubscription,
    subscribeUserToPlan,
    cancelUserSubscription,
    addReaction,
    addLike,
    incrementShareCount,
    login,
    logout,
    registerOrLoginUser,
    updateUserProfile,
    followUser,
    unfollowUser,
    setTagFilter: setTagFilterCallback,
    setViewCreator: setViewCreatorCallback,
    setViewCreatorBySlug,
    shareVitrine,
    setCurrentScreen,
    updateDevSettings,
    addCreditsToUser,
    toggleContentVisibility,
    removeContent,
    setTimeOut,
    hideAllContentFromCreator,
    deleteAllContentFromCreator,
    isTimedOut,
    timeoutInfo,
    processWithdrawal,
    sidebarVisibility,
    updateSidebarVisibility,
    navbarVisibility,
    updateNavbarVisibility,
  }), [
      balance, earnedBalance, transactions, creatorTransactions, contentItems, 
      subscriptionPlans, creditPackages, userSubscription, subscriptions, devSettings, currentUser, currentScreen,
      unlockedContentIds, withdrawalTimeEnd, isLoggedIn, allUsers, activeTagFilter, viewingCreatorId,
      showcasedUserIds, theme, addCredits, processPurchase, addReward, addContentItem, deleteContent, 
      updateSubscriptionPlan, updateCreditPackage, subscribeToPlan, cancelSubscription, subscribeUserToPlan, 
      cancelUserSubscription, addReaction, addLike, incrementShareCount, login, logout, registerOrLoginUser, 
      updateUserProfile, followUser, unfollowUser, setTagFilterCallback, setViewCreatorCallback, setViewCreatorBySlug, shareVitrine, 
      updateDevSettings, addCreditsToUser, toggleContentVisibility, removeContent, setTimeOut, 
      hideAllContentFromCreator, deleteAllContentFromCreator, isTimedOut, timeoutInfo, sidebarVisibility, 
      updateSidebarVisibility, navbarVisibility, updateNavbarVisibility,
  ]);

  return (
    <CreditsContext.Provider value={contextValue}>
      {children}
    </CreditsContext.Provider>
  );
};