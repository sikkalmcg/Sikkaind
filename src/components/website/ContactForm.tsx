'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  subject: z.string().min(5, 'Subject must be at least 5 characters.'),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
});

type FormValues = z.infer<typeof formSchema>;

export default function ContactForm() {
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: FormValues) => {
    // Artificial delay for handshake visualization
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log(values);
    toast({
      title: 'Message Transmitted',
      description: 'Your enquiry has been successfully registered in our node.',
    });
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} className="h-12 rounded-xl font-bold bg-white border-slate-200" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address *</FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" {...field} className="h-12 rounded-xl font-bold bg-white border-slate-200" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject Node *</FormLabel>
              <FormControl>
                <Input placeholder="Registry Enquiry" {...field} className="h-12 rounded-xl font-bold bg-white border-slate-200" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission Details *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="How can we assist with your logistics node?" 
                  {...field} 
                  rows={5}
                  className="rounded-2xl font-bold bg-white border-slate-200 resize-none" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full h-14 bg-blue-900 hover:bg-black font-black uppercase text-xs tracking-[0.3em] rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          {isSubmitting ? 'Transmitting...' : 'Send Enquiry Node'}
        </Button>
      </form>
    </Form>
  );
}
