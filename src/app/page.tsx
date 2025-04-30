'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-bold mb-6">Welcome to Stock Gainers</h1>
        <p className="mb-8 text-gray-600">Track top gaining stocks with interactive charts and real-time market data.</p>
        <button
          onClick={handleGoToDashboard}
          className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
