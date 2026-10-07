import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ConfirmProvider } from '../ui/Confirm'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const SIDEBAR_KEY = 'yargan.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, prev ? '0' : '1')
      } catch {
        // yok say
      }
      return !prev
    })
  }

  return (
    <ConfirmProvider>
      <div className="flex h-full">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1840px] px-4 py-6 sm:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ConfirmProvider>
  )
}
