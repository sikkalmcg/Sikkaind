
'use client';

import ContactForm from '@/components/website/ContactForm';
import { Mail, Phone } from 'lucide-react';
import Image from 'next/image';
import placeholderData from '@/app/lib/placeholder-images.json';

export default function ContactPage() {
    const bgAsset = placeholderData.placeholderImages.find(p => p.id === 'contact-bg');

    return (
        <div className="bg-white">
            <section className="relative py-16 md:py-24 text-white overflow-hidden">
                 {bgAsset?.url && (
                    <Image
                        src={bgAsset.url}
                        alt="Warehouse office background"
                        fill
                        className="z-0 object-cover"
                        priority
                        unoptimized={true}
                    />
                 )}
                <div className="absolute inset-0 bg-blue-900/70 z-10" />
                <div className="container mx-auto px-4 relative z-20 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-slide-down">Contact Us</h1>
                    <p className="text-xl md:text-2xl max-w-3xl mx-auto font-light animate-fade-in">
                        Get in touch with us for any query, suggestion, or business enquiry.
                    </p>
                </div>
            </section>

            <div className="py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Contact Information</h3>
                                <div className="space-y-4 text-gray-700">
                                    <div className="flex items-center gap-4">
                                        <Mail className="h-6 w-6 text-blue-600" />
                                        <a href="mailto:queries@sikka.com" className="hover:text-blue-600">queries@sikka.com</a>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Phone className="h-6 w-6 text-blue-600" />
                                        <span>Delhi: +91 11 27205565</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Phone className="h-6 w-6 text-blue-600" />
                                        <span>Ghaziabad: +91 120 4290010</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Our Offices</h3>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-lg text-gray-700">Corporate Office</h4>
                                        <p className="text-gray-600">Sikka Industries & Logistics<br/>Ghaziabad – 201009, Uttar Pradesh<br/>India</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-lg text-gray-700">Branch Office</h4>
                                        <p className="text-gray-600">Sikka Industries & Logistics<br/>Delhi 110036, New Delhi<br/>India</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-8 rounded-xl shadow-lg border border-gray-200/50">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-2">Send us a Message</h3>
                            <p className="text-gray-600 mb-6">Leave your details and we shall contact you within 24 hours.</p>
                            <ContactForm />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
