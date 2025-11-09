import React, { useState } from 'react';
import { useCredits } from '../hooks/useCredits';
import { ContentItem, Screen } from '../types';
import Notification from '../components/Notification';
import { supabase } from '../src/integrations/supabase/client';

interface CreateContentProps {
  navigate: (screen: Screen) => void;
}

const CreateContent: React.FC<CreateContentProps> = ({ navigate }) => {
    const { addContentItem, devSettings, currentUser } = useCredits();
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [offerText, setOfferText] = useState('');
    const [tags, setTags] = useState('');
    const [blurLevel, setBlurLevel] = useState(5);
    const [useExternalLink, setUseExternalLink] = useState(false);
    const [externalLink, setExternalLink] = useState('');
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [uploadedVideos, setUploadedVideos] = useState<File[]>([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
    
    const [notification, setNotification] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    if (!currentUser) {
        return <div>You must be logged in to create content.</div>;
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const remainingSlots = devSettings.maxImagesPerCard - uploadedImages.length;
            const newFiles = files.slice(0, remainingSlots);
            const newPreviewUrls = newFiles.map((file: File) => URL.createObjectURL(file));
            setUploadedImages(prev => [...prev, ...newFiles]);
            setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
        }
    };
    
    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const remainingSlots = devSettings.maxVideosPerCard - uploadedVideos.length;
            const newFiles = files.slice(0, remainingSlots);
            setUploadedVideos(prev => [...prev, ...newFiles]);
        }
    }


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isFormValid = title && price && parseInt(price) > 0 && 
                            (useExternalLink ? externalLink : (uploadedImages.length > 0 || uploadedVideos.length > 0));

        if (!isFormValid) {
            alert('Please fill all required fields and add content.');
            return;
        }

        setIsLoading(true);

        try {
            // Generate content ID
            const contentId = crypto.randomUUID();
            
            // Upload images to Supabase Storage
            const imageUploadPromises = uploadedImages.map(async (file, index) => {
                const fileExt = file.name.split('.').pop();
                const filePath = `${currentUser.id}/${contentId}/image_${index}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('content-media')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    throw uploadError;
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('content-media')
                    .getPublicUrl(filePath);

                return { url: publicUrl, type: 'image', order: index };
            });

            // Upload videos to Supabase Storage
            const videoUploadPromises = uploadedVideos.map(async (file, index) => {
                const fileExt = file.name.split('.').pop();
                const filePath = `${currentUser.id}/${contentId}/video_${index}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('content-media')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Error uploading video:', uploadError);
                    throw uploadError;
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('content-media')
                    .getPublicUrl(filePath);

                return { url: publicUrl, type: 'video', order: index };
            });

            const uploadedMedia = await Promise.all([...imageUploadPromises, ...videoUploadPromises]);

            // Create thumbnail URL with transformation
            const firstImageUrl = uploadedMedia.find(m => m.type === 'image')?.url || `https://picsum.photos/seed/${contentId}/600/800`;
            const thumbnailUrl = firstImageUrl.includes('supabase') 
                ? `${firstImageUrl}?width=400&height=600&quality=80`
                : firstImageUrl;

            // Create content item
            const newItem: ContentItem = {
                id: contentId,
                creatorId: currentUser.id,
                title,
                price: parseInt(price, 10),
                offerText,
                userReactions: {},
                mediaCount: {
                    images: uploadedImages.length,
                    videos: uploadedVideos.length,
                },
                imageUrl: firstImageUrl,
                thumbnailUrl,
                blurLevel,
                externalLink: useExternalLink ? externalLink : undefined,
                likedBy: [],
                sharedBy: [],
                createdAt: new Date().toISOString(),
                tags: tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean),
            };

            // Save content item to database
            await addContentItem(newItem);

            // Save media references to database
            if (uploadedMedia.length > 0) {
                const mediaRecords = uploadedMedia.map(media => ({
                    content_item_id: contentId,
                    media_type: media.type as 'image' | 'video',
                    storage_path: media.url,
                    display_order: media.order
                }));

                const { error: mediaError } = await supabase
                    .from('media')
                    .insert(mediaRecords);

                if (mediaError) {
                    console.error('Error saving media records:', mediaError);
                }
            }

            setNotification('Content created successfully!');
            setTimeout(() => {
                setNotification(null);
                navigate('home');
            }, 2000);
        } catch (error) {
            console.error('Error creating content:', error);
            alert('Failed to create content. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const canUploadImages = uploadedImages.length < devSettings.maxImagesPerCard;
    const canUploadVideos = uploadedVideos.length < devSettings.maxVideosPerCard;

    return (
        <div className="max-w-2xl mx-auto">
            {notification && <Notification message={notification} type="success" />}
            <h1 className="text-3xl font-bold text-white mb-6">Create New Content</h1>
            <div className="bg-neutral-800 rounded-lg shadow-lg p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-neutral-300">Title</label>
                        <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full bg-neutral-700 border-neutral-600 rounded-md py-2 px-3 text-white" placeholder="e.g., Mystic Forest" required />
                    </div>
                    <div>
                        <label htmlFor="price" className="block text-sm font-medium text-neutral-300">Price (in credits)</label>
                        <input type="number" id="price" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 block w-full bg-neutral-700 border-neutral-600 rounded-md py-2 px-3 text-white" placeholder="e.g., 200" required min="1" />
                    </div>
                    <div>
                        <label htmlFor="offerText" className="block text-sm font-medium text-neutral-300">Offer Text (Optional)</label>
                        <input type="text" id="offerText" value={offerText} onChange={(e) => setOfferText(e.target.value)} className="mt-1 block w-full bg-neutral-700 border-neutral-600 rounded-md py-2 px-3 text-white" placeholder="e.g., Limited time offer!" />
                    </div>
                    <div>
                        <label htmlFor="tags" className="block text-sm font-medium text-neutral-300">Tags (comma-separated)</label>
                        <input type="text" id="tags" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 block w-full bg-neutral-700 border-neutral-600 rounded-md py-2 px-3 text-white" placeholder="e.g., #art, #scifi, #tutorial" />
                    </div>

                    {/* Blur Level */}
                    <div>
                        <label htmlFor="blurLevel" className="block text-sm font-medium text-neutral-300">Blur Level: {blurLevel}</label>
                        <input type="range" id="blurLevel" min="0" max="10" value={blurLevel} onChange={e => setBlurLevel(Number(e.target.value))} className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    {/* External Link Toggle */}
                    <div className="flex items-center justify-between">
                         <label htmlFor="useExternalLink" className="text-sm font-medium text-neutral-300">Sell External Link</label>
                        <label className="inline-flex relative items-center cursor-pointer">
                            <input type="checkbox" id="useExternalLink" checked={useExternalLink} onChange={() => setUseExternalLink(!useExternalLink)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>

                    {/* Content Uploads */}
                    {useExternalLink ? (
                         <div>
                            <label htmlFor="externalLink" className="block text-sm font-medium text-neutral-300">External URL</label>
                            <input type="url" id="externalLink" value={externalLink} onChange={e => setExternalLink(e.target.value)} className="mt-1 block w-full bg-neutral-700 border-neutral-600 rounded-md py-2 px-3 text-white" placeholder="https://example.com" required />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-neutral-300">Upload Media</label>
                            {imagePreviewUrls.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    {imagePreviewUrls.map((url, index) => <img key={index} src={url} className="h-24 w-full object-cover rounded"/>)}
                                </div>
                            )}
                            <div className="mt-2 flex gap-4">
                               <label className={`flex-1 text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${canUploadImages ? 'bg-brand-secondary hover:bg-brand-secondary/90 cursor-pointer' : 'bg-neutral-600 cursor-not-allowed'}`}>
                                   <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" disabled={!canUploadImages} />
                                   Add Images ({uploadedImages.length}/{devSettings.maxImagesPerCard})
                               </label>
                               <label className={`flex-1 text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${canUploadVideos ? 'bg-brand-light/80 hover:bg-brand-light/70 cursor-pointer' : 'bg-neutral-600 cursor-not-allowed'}`}>
                                   <input type="file" multiple accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={!canUploadVideos} />
                                   Add Videos ({uploadedVideos.length}/{devSettings.maxVideosPerCard})
                               </label>
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-2">
                         <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50">
                            {isLoading ? 'Creating...' : 'Create Content Card'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateContent;