
'use client';
import { Truck, Globe, Warehouse, PackageCheck, FileText, ShieldCheck, Shuffle, Laptop, Users, Scaling } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import placeholderData from '@/app/lib/placeholder-images.json';

const services = [
    {
        icon: Truck,
        title: 'Domestic Transportation',
        description: 'We provide reliable PAN India domestic transportation services ensuring timely and secure movement of goods across industrial hubs, metro cities, and rural locations in India.',
    },
    {
        icon: Globe,
        title: 'Freight Forwarding',
        description: `Our freight forwarding services provide seamless domestic and international cargo movement through air, sea, and multimodal transportation.`,
    },
    {
        icon: Warehouse,
        title: 'Warehousing Facility',
        description: 'We offer modern warehousing facilities designed to support efficient inventory management and distribution operations.',
    },
    {
        icon: PackageCheck,
        title: 'Manufacturing & Packaging Solutions',
        description: 'We provide value-added manufacturing support and packaging solutions tailored to supply chain requirements.',
    },
    {
        icon: FileText,
        title: 'Regulatory Compliance Services',
        description: 'Our regulatory compliance services ensure smooth logistics operations in accordance with government norms and statutory requirements in India.',
    },
];

const features = [
    {
        icon: Globe,
        title: 'PAN India Operational Network',
        description: 'Our extensive network across India enables seamless cargo movement, faster turnaround times, and consistent service delivery.'
    },
    {
        icon: ShieldCheck,
        title: 'HACCP-Certified Processes',
        description: 'We follow HACCP-compliant warehousing and handling standards, ensuring safety, hygiene, and quality control.'
    },
    {
        icon: Shuffle,
        title: 'Multimodal Transportation Expertise',
        description: 'Integrated road, rail, air, and sea solutions provide flexible, cost-effective, and time-bound freight management.'
    },
    {
        icon: Laptop,
        title: 'Technology-Driven Tracking Systems',
        description: 'Advanced GPS tracking, Warehouse Management Systems (WMS), and real-time reporting tools offer complete shipment visibility.'
    },
    {
        icon: Users,
        title: 'Experienced Logistics Professionals',
        description: 'Our skilled operations team ensures structured planning, risk mitigation, and regulatory compliance at every stage.'
    },
    {
        icon: Scaling,
        title: 'Scalable & Customized Solutions',
        description: 'We design flexible logistics models that adapt to evolving business volumes, seasonal demand, and expansion strategies.'
    }
];

export default function ServicesPage() {
    const bgAsset = placeholderData.placeholderImages.find(p => p.id === 'services-bg');

    return (
        <div className="bg-white text-gray-800">
            <section className="relative py-12 md:py-16 text-white bg-blue-900 overflow-hidden">
                {bgAsset?.url && (
                    <Image
                        src={bgAsset.url}
                        alt="Logistics background"
                        fill
                        className="z-0 opacity-20 object-cover"
                        priority
                        unoptimized={true}
                    />
                )}
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-slide-down">Our Services</h1>
                    <p className="text-xl md:text-2xl max-w-3xl mx-auto font-light animate-fade-in">
                        Comprehensive logistics and supply chain solutions tailored to your business needs.
                    </p>
                </div>
            </section>

            <section className="py-16 md:py-24 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {services.map((service) => (
                             <Card key={service.title} className="bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                                <CardHeader className="flex flex-row items-center gap-4">
                                    <service.icon className="h-10 w-10 text-primary" />
                                    <CardTitle className="text-xl">{service.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow flex flex-col">
                                    <p className="text-muted-foreground whitespace-pre-line flex-grow italic">{service.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>
            
            <section className="py-16 md:py-24 bg-gradient-to-b from-white to-gray-100">
              <div className="container mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose Our Services?</h2>
                    <p className="text-lg text-gray-600">
                        We deliver dependable, end-to-end warehousing, logistics, and supply chain solutions designed to enhance operational efficiency.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="bg-white p-8 rounded-lg shadow-lg border border-gray-200/50 transition-all duration-300 hover:shadow-2xl hover:border-blue-200 hover:-translate-y-2">
                            <div className="flex items-center mb-4">
                                <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                                    <feature.icon className="h-7 w-7" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{feature.title}</h3>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-16">
                    <Button size="lg" asChild className="text-lg py-7 px-10">
                        <Link href="/contact">Request a Quote</Link>
                    </Button>
                </div>
              </div>
            </section>
        </div>
    );
}
