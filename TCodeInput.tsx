import { useRouter } from 'next/navigation';
import { useState, KeyboardEvent } from 'react';

const TCodeInput = () => {
  const router = useRouter();
  const [tcode, setTcode] = useState('');

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && tcode) {
      // Navigate to the correct dashboard path, e.g., /dashboard/vt01
      router.push(`/dashboard/${tcode.toLowerCase()}`);
    }
  };

  return (
    <input
      type="text"
      value={tcode}
      onChange={(e) => setTcode(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Enter T-Code..."
      style={{ padding: '8px', marginRight: '16px', border: '1px solid #ccc', borderRadius: '4px' }}
    />
  );
};

export default TCodeInput;