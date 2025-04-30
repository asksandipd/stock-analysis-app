'use client';

export function LoadingScreen() {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-600 text-lg loading-dots">Loading data</p>
    </div>
  );
}