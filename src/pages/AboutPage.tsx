import React from 'react';

export const AboutPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-white p-8 font-sans text-slate-800">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl font-bold mb-6">About Sukoon</h1>
                <section className="mb-8">
                    <h2 className="text-2xl font-bold mb-3">Project Overview</h2>
                    <p className="text-slate-600">Sukoon is a private, intelligent, and empathetic mental wellness platform designed to support real-life stress, anxiety, and emotional challenges for everyone.</p>
                </section>
                <section className="mb-8">
                    <h2 className="text-2xl font-bold mb-3">Mission</h2>
                    <p className="text-slate-600">Our mission is to make evidence-based mental health support accessible, stigma-free, and personalized to every individual's needs.</p>
                </section>
            </div>
        </div>
    );
};
