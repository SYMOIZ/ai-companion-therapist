
import React, { useState, useEffect, useRef } from 'react';
import { searchUsers } from '../services/dataService';

interface UserOption {
    id: string;
    name: string;
    email: string;
    avatar?: string;
}

interface SearchableSelectProps {
    role: 'client' | 'therapist';
    placeholder: string;
    onSelect: (userId: string, userName: string) => void;
    initialValue?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ role, placeholder, onSelect, initialValue = '' }) => {
    const [query, setQuery] = useState(initialValue);
    const [options, setOptions] = useState<UserOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (query.length > 1) {
                setLoading(true);
                const results = await searchUsers(query, role);
                setOptions(results);
                setLoading(false);
                setIsOpen(true);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [query, role]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (user: UserOption) => {
        setQuery(user.name);
        onSelect(user.id, user.name);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm font-medium focus:ring-2 focus:ring-teal-500 transition-all"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setIsOpen(true)}
                />
                {loading && (
                    <div className="absolute right-3 top-3.5">
                        <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {isOpen && options.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in">
                    {options.map((user) => (
                        <div
                            key={user.id}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer flex items-center gap-3 transition-colors"
                            onClick={() => handleSelect(user)}
                        >
                            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover"/> : user.name?.charAt(0) || 'U'}
                            </div>
                            <div className="overflow-hidden">
                                <div className="font-bold text-slate-800 dark:text-white text-sm truncate">{user.name}</div>
                                <div className="text-xs text-slate-400 truncate">{user.email}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {isOpen && options.length === 0 && !loading && query.length > 1 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 rounded-xl shadow-xl p-4 text-center text-xs text-slate-400">
                    No users found matching "{query}"
                </div>
            )}
        </div>
    );
};
