'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export function Navigation() {
  const { data: session } = useSession()

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-800">
                Stock Analysis
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/dashboard"
                className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300"
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            {session ? (
              <button
                onClick={() => signOut()}
                className="text-gray-900 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="text-gray-900 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}