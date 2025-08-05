"use client";

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { parseCsv } from '../lib/csvParser';

const ReportsModal = ({ open, setOpen }) => {
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [downloadsData, setDownloadsData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Subscriptions
        const subsResponse = await fetch('/itunes_subscriptionsEvent_chart-2025-07-06-2025-08-04.csv');
        const subsText = await subsResponse.text();
        const subsParsed = await parseCsv(subsText);
        setSubscriptionsData(transformSubscriptions(subsParsed));

        // Downloads
        const downloadsResponse = await fetch('/predictive_play-total_downloads-20250706-20250804.csv');
        const downloadsText = await downloadsResponse.text();
        const downloadsParsed = await parseCsv(downloadsText);
        setDownloadsData(transformDownloads(downloadsParsed));

        // Revenue
        const revenueResponse = await fetch('/rc-1754429936872-Revenue-20250725-20250805.csv');
        const revenueText = await revenueResponse.text();
        const revenueParsed = await parseCsv(revenueText);
        setRevenueData(transformRevenue(revenueParsed));
      } catch (error) {
        console.error("Failed to parse CSV data", error);
      }
    };

    if (open) {
      fetchAllData();
    }
  }, [open]);

  const transformSubscriptions = (data) => {
    const eventTypes = ["Activations", "Cancellations", "Renewals"];
    const transformed = {};

    data.forEach(row => {
        const eventType = row['Event Type'];
        if (eventTypes.includes(eventType)) {
            Object.keys(row).forEach(key => {
                if (key.match(/\d{4}-\d{2}-\d{2}/)) {
                    const date = new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (!transformed[date]) {
                        transformed[date] = { date };
                    }
                    transformed[date][eventType] = row[key];
                }
            });
        }
    });

    return Object.values(transformed);
  };

  const transformDownloads = (data) => {
    return data.map(row => ({
      date: new Date(row.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'App Referrer': row['App Referrer'],
      'App Store Browse': row['App Store Browse'],
      'App Store Search': row['App Store Search'],
    }));
  };

  const transformRevenue = (data) => {
    return data.map(row => ({
      date: new Date(row.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: row.Revenue,
    }));
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
