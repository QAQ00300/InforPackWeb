import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InfoSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function InfoSection({ title, defaultOpen = true, children }: InfoSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="section-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
          <h3 className="font-medium text-gray-700">{title}</h3>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}