"use client"

interface FuseButtonProps {
  isDisabled: boolean
  isLoading: boolean
  onClick: () => void
}

export default function FuseButton({ isDisabled, isLoading, onClick }: FuseButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`px-8 py-3 rounded-lg font-semibold text-white transition-all flex items-center gap-2 ${
        isDisabled ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
      }`}
    >
      {isLoading ? (
        <>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Fusing...
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3 3L20 4m-9 8l-3-3m0 0L3 4" />
          </svg>
          Fuse Documents
        </>
      )}
    </button>
  )
}
