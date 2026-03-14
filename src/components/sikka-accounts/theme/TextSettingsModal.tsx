'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface TextSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const fontFamilies = ['Inter', 'Arial', 'Verdana', 'Helvetica', 'Tahoma', 'Georgia', 'Times New Roman'];
const fontStyles = ['Normal', 'Italic', 'Bold'];
const fontSizes = [10, 11, 12, 13, 14];

const fontWeights: { [key: string]: number } = {
  'Normal': 400,
  'Bold': 700,
  'Italic': 400,
};
const fontStyleValues: { [key: string]: string } = {
  'Normal': 'normal',
  'Bold': 'normal',
  'Italic': 'italic',
};

export default function TextSettingsModal({ isOpen, onClose }: TextSettingsModalProps) {
  const { toast } = useToast();
  const form = useForm();
  
  useEffect(() => {
    if (isOpen) {
      try {
        const rootStyle = document.documentElement.style;
        const savedSettings = {
            family: rootStyle.getPropertyValue('--font-family').trim().replace(/"/g, '') || 'Inter',
            weight: parseInt(rootStyle.getPropertyValue('--font-weight').trim(), 10) || 400,
            style: rootStyle.getPropertyValue('--font-style').trim() || 'normal',
            size: parseInt(rootStyle.getPropertyValue('--font-size-base').replace('px','').trim(), 10) || 14
        };

        let styleName = 'Normal';
        if (savedSettings.style === 'italic') styleName = 'Italic';
        if (savedSettings.weight === 700) styleName = 'Bold';

        form.reset({
          fontFamily: savedSettings.family,
          fontStyle: styleName,
          fontSize: savedSettings.size,
        });
      } catch (e) {
         form.reset({ fontFamily: 'Inter', fontStyle: 'Normal', fontSize: 14 });
      }
    }
  }, [isOpen, form]);

  const handleApply = (values: any) => {
    const settings = {
        family: values.fontFamily,
        styleName: values.fontStyle, // e.g. 'Bold'
        weight: fontWeights[values.fontStyle], // e.g. 700
        style: fontStyleValues[values.fontStyle], // e.g. 'normal'
        size: values.fontSize, // e.g. 12
    };
    
    document.documentElement.style.setProperty('--font-family', settings.family);
    document.documentElement.style.setProperty('--font-weight', String(settings.weight));
    document.documentElement.style.setProperty('--font-style', settings.style);
    document.documentElement.style.setProperty('--font-size-base', `${settings.size}px`);

    toast({ title: 'Success', description: 'Text appearance updated.' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Text Appearance Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleApply)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="fontFamily"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Font Family</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{fontFamilies.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="fontStyle"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Font Style</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{fontStyles.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="fontSize"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Font Size (px)</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={String(field.value)}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{fontSizes.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />

                <DialogFooter>
                    <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Apply</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
