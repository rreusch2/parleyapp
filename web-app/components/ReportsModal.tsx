"use client";

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const ReportsModal = ({ open, setOpen }) => {
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [downloadsData, setDownloadsData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  useEffect(() => {
    // Fetch and parse data here
    const fetchAllData = async () => {
      // Subscriptions
      const subsResponse = await fetch('/itunes_subscriptionsEvent_chart-2025-07-06-2025-08-04.csv');
      const subsText = await subsResponse.text();
      const subsParsed = parseSubscriptions(subsText);
      setSubscriptionsData(subsParsed);

      // Downloads
      const downloadsResponse = await fetch('/predictive_play-total_downloads-20250706-20250804.csv');
        const downloadsText = await downloadsResponse.text();
        const downloadsParsed = parseDownloads(downloadsText);
        setDownloadsData(downloadsParsed);

      // Revenue
      const revenueResponse = await fetch('rc-1754429936872-Revenue-20250725-20250805.csv');
        const revenueText = await revenueResponse.text();
        const revenueParsed = parseRevenue(revenueText);
        setRevenueData(revenueParsed);
    };

    fetchAllData();
  }, []);
    
    const parseSubscriptions = (text) => {
        const lines = text.split('\n').slice(4, -1);
        const headers = lines[0].split(',').slice(2, -1).map(h => h.trim().replace(/"/g, ''));
        const eventTypes = ["Activations", "Cancellations", "Renewals"];
        const data = [];

        lines.slice(1).forEach(line => {
            const columns = line.split(',');
            const eventType = columns[0].replace(/"/g, '').trim();
            if (eventTypes.includes(eventType)) {
                const values = columns.slice(2, -1).map(v => parseInt(v.replace(/"/g, '')));
                headers.forEach((header, i) => {
                    const date = new Date(header).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    let entry = data.find(d => d.date === date);
                    if (!entry) {
                        entry = { date };
                        data.push(entry);
                    }
                    entry[eventType] = values[i];
                });
            }
        });

        return data;
    };
    
    const parseDownloads = (text) => {
        const lines = text.split('\n').slice(5);
        const data = lines.map(line => {
            const [date, ...values] = line.split(',');
            return {
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                'App Referrer': parseInt(values[0]),
                'App Store Browse': parseInt(values[1]),
                'App Store Search': parseInt(values[2]),
            };
        });
        return data;
    };

    const parseRevenue = (text) => {
        const lines = text.split('\n').slice(2);
        const data = lines.map(line => {
            const [date, revenue] = line.split(',');
            return {
                date: new Date(date.replace(/"/g, '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                revenue: parseFloat(revenue.replace(/"/g, '')),
            };
        });
        return data;
    };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Dialog.Panel className="relative w-full max-w-4xl transform rounded-lg bg-white p-6 text-left shadow-xl transition-all">
              <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  onClick={() => setOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                Data Reports
              </Dialog.Title>
              <div className="mt-2">
                <div className="grid grid-cols-1 gap-6">
                  {/* Subscription Events */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800">Subscription Events</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={subscriptionsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Activations" fill="#8884d8" />
                        <Bar dataKey="Cancellations" fill="#82ca9d" />
                        <Bar dataKey="Renewals" fill="#ffc658" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* App Downloads */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800">App Downloads</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={downloadsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="App Referrer" stroke="#8884d8" />
                        <Line type="monotone" dataKey="App Store Browse" stroke="#82ca9d" />
                        <Line type="monotone" dataKey="App Store Search" stroke="#ffc658" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800">Revenue</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default ReportsModal;
