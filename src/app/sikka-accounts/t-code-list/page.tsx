'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { TCODE_DESCRIPTIONS } from '@/lib/sikka-accounts-constants';

export default function TCodeListPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const tcodes = useMemo(() => 
    Object.entries(TCODE_DESCRIPTIONS).sort((a, b) => a[0].localeCompare(b[0])), 
  []);

  const filteredTcodes = useMemo(() => {
    return tcodes.filter(([code, description]) => 
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tcodes, searchTerm]);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <Card>
        <CardHeader>
          <CardTitle>T-Code List</CardTitle>
          <CardDescription>A list of all available transaction codes and their descriptions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by T-Code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <div className="rounded-md border max-h-[calc(100vh-250px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">T-Code</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTcodes.length > 0 ? (
                  filteredTcodes.map(([code, description]) => (
                    <TableRow key={code}>
                      <TableCell className="font-mono">{code}</TableCell>
                      <TableCell>{description}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center h-24">
                      No T-Codes found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
