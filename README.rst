cpufreq
=======

Python library and CLI to inspect and control CPU frequency scaling on Linux
via the kernel ``cpufreq`` sysfs interface (``/sys/devices/system/cpu``).

Useful for power experiments, performance pinning, disabling SMT/hyperthreads,
and scripting governor or frequency changes.

Features
--------

- Read the active scaling driver, governors, and frequencies per CPU
- List available governors and (when exposed by the driver) discrete frequencies
- Set governors and target frequencies (all online CPUs or a selected subset)
- Adjust minimum and maximum scaling frequency limits
- Enable/disable individual CPUs and bring all present CPUs online
- Disable hyperthreads (secondary SMT siblings), keeping one thread per core
- Reset CPUs to a known baseline (``ondemand`` governor, full frequency range)
- Command-line tool (``cpufreq``) and importable Python API
- Singleton ``cpuFreq`` instance with structured errors (``CPUFreqError``,
  ``CPUFreqErrorInit``)

Requirements
------------

- **Linux only** — other platforms raise ``CPUFreqErrorInit`` at construction
- **CPU frequency scaling enabled** — BIOS/UEFI typically allows OS power
  management (not a locked fixed frequency)
- **Kernel cpufreq interface** — e.g. ACPI, intel_pstate, or another driver
  exposing ``cpu0/cpufreq/scaling_driver``
- **Python 3** (3.5+ recommended; Python 2 is not supported)
- **Write access to sysfs** for set/enable/disable operations — usually run as
  **root**; read-only queries may work unprivileged depending on policy

**Note:** Some drivers (notably certain ``intel_pstate`` setups) do not expose
``scaling_available_frequencies``. In that case ``available_frequencies`` is an
empty list and fixed-frequency writes via ``userspace`` / ``scaling_setspeed``
may not apply. Governor and min/max limit APIs still work when supported.

Installation
------------

::

    pip3 install cpufreq

From source (development)::

    git clone https://github.com/VitorRamos/cpufreq.git
    cd cpufreq
    pip3 install -e .

Quick start (CLI)
-----------------

Show driver, governors, and per-CPU status::

    sudo cpufreq --info

Set a governor on specific CPUs (0-based indices)::

    sudo cpufreq setgovernor powersave --cpus 0,1,2

Set a governor on all online CPUs::

    sudo cpufreq setgovernor performance --all

Pin a frequency in **kHz** (CLI validates against ``available_frequencies`` when
present; typically requires the ``userspace`` governor)::

    sudo cpufreq setfrequency 2100000 --cpus 0,1
    sudo cpufreq setfrequency 2100000 --all

Reset governors and min/max frequency limits::

    sudo cpufreq --reset

Help (works even when cpufreq sysfs is unavailable)::

    cpufreq --help

CLI overview
~~~~~~~~~~~~

================ ===============================================================
Command / flag   Description
================ ===============================================================
``--info``       Print driver, governors/frequencies, per-CPU status
``--reset``      Reset governors and scaling min/max frequencies
``setgovernor``  Set scaling governor (``--all`` or ``--cpus 0,1,…``)
``setfrequency`` Set target frequency in kHz (``--all`` or ``--cpus 0,1,…``)
``--help``       Show usage
================ ===============================================================

Frequencies in the CLI and API are in **kilohertz (kHz)** unless noted.

Quick start (Python API)
------------------------

::

    from cpufreq import cpuFreq, CPUFreqError, CPUFreqErrorInit

    try:
        cpu = cpuFreq()
    except CPUFreqErrorInit as e:
        print(e)
        raise SystemExit(1)

    # Introspection
    print(cpu.driver)
    print(cpu.available_governors)
    print(cpu.available_frequencies)   # may be [] on some drivers
    print(cpu.get_online_cpus())
    print(cpu.get_governors())         # {cpu_id: governor_name, ...}
    print(cpu.get_frequencies())       # {cpu_id: freq_khz, ...}
    print(cpu.get_min_freq())
    print(cpu.get_max_freq())

    # Control (typically requires root)
    cpu.set_governors("performance")                 # all online CPUs
    cpu.set_governors("powersave", rg=[0, 1])        # subset
    cpu.set_governors("userspace")
    if cpu.available_frequencies:
        cpu.set_frequencies(cpu.available_frequencies[-1])

    cpu.set_min_frequencies(1200000)
    cpu.set_max_frequencies(2400000)

    cpu.disable_hyperthread()   # offline SMT siblings
    cpu.disable_cpu(2)
    cpu.enable_cpu(2)
    cpu.enable_all_cpu()

    cpu.reset()

A longer walkthrough is in ``example.py``.

Python API reference
--------------------

``cpuFreq`` (singleton)
~~~~~~~~~~~~~~~~~~~~~~~

Construction fails with ``CPUFreqErrorInit`` if the host is not Linux or the
cpufreq sysfs interface is missing/unreadable. Only one instance is created
(``__new__`` returns the same object).

Attributes
^^^^^^^^^^

======================== =======================================================
Attribute                Description
======================== =======================================================
``driver``               Active scaling driver (from ``scaling_driver``)
``available_governors``  Governors reported for CPU 0
``available_frequencies`` Discrete frequencies in kHz, or ``[]`` if not exposed
``BASEDIR``              Sysfs base path (``/sys/devices/system/cpu``)
======================== =======================================================

Methods
^^^^^^^

=============================== =================================================
Method                          Description
=============================== =================================================
``get_online_cpus()``           List of online CPU indices
``get_governors()``             Dict ``cpu ->`` current ``scaling_governor``
``get_frequencies()``           Dict ``cpu ->`` current frequency (int, kHz)
``get_min_freq(rg=None)``       Dict ``cpu ->`` ``scaling_min_freq``
``get_max_freq(rg=None)``       Dict ``cpu ->`` ``scaling_max_freq``
``set_governors(gov, rg=None)`` Write ``scaling_governor``
``set_frequencies(freq, rg=None)`` Write ``scaling_setspeed`` (int kHz)
``set_min_frequencies(freq, rg=None)`` Write ``scaling_min_freq``
``set_max_frequencies(freq, rg=None)`` Write ``scaling_max_freq``
``enable_cpu(rg)``              Online listed CPUs that are offline
``disable_cpu(rg)``             Offline listed CPUs that are online
``enable_all_cpu()``            Online all present CPUs that are offline
``disable_hyperthread()``       Offline secondary thread siblings (SMT)
``reset(rg=None)``              Enable CPUs, set ``ondemand``, restore min/max
=============================== =================================================

For methods that accept ``rg``, pass a single ``int``, a list of CPU indices, or
omit / ``None`` to target all **online** CPUs (except paths that use **present**
CPUs as implemented in code).

Exceptions
~~~~~~~~~~

=================== ============================================================
Exception           When
=================== ============================================================
``CPUFreqError``    General API/runtime error (invalid frequency, failed write)
``CPUFreqErrorInit`` Failed to initialize: wrong OS, missing driver, bad sysfs
=================== ============================================================

Import from the top-level package::

    from cpufreq import cpuFreq, CPUFreqError, CPUFreqErrorInit

Typical workflows
-----------------

Benchmark with fixed frequency and no SMT::

    from cpufreq import cpuFreq

    cpu = cpuFreq()
    cpu.reset()
    cpu.disable_hyperthread()
    cpu.set_governors("userspace")
    if not cpu.available_frequencies:
        raise RuntimeError("Driver does not expose discrete frequencies")
    target = cpu.available_frequencies[len(cpu.available_frequencies) // 2]
    cpu.set_frequencies(target)
    # run workload ...
    cpu.reset()

Power saving on a subset of cores::

    from cpufreq import cpuFreq

    cpu = cpuFreq()
    cpu.set_governors("powersave", rg=[2, 3, 4, 5])

Limitations and caveats
-----------------------

- **Privileges:** Writing governors, frequencies, or online/offline usually
  needs root.
- **Driver differences:** Behavior depends on the kernel driver
  (``acpi-cpufreq``, ``intel_pstate``, ``amd-pstate``, etc.). Not all methods
  are meaningful on every system.
- **``reset()`` and empty frequencies:** ``reset()`` sets min/max from
  ``min(available_frequencies)`` / ``max(available_frequencies)``. If that list
  is empty, reset may fail; prefer driver-appropriate limits on such systems.
- **``set_frequencies``:** Writes ``scaling_setspeed``, effective mainly with
  governors that honor it (commonly ``userspace``). Frequency must lie within
  the current min/max window.
- **CPU 0:** Many kernels disallow offlining CPU 0.
- **Safety:** Offlining CPUs or locking frequencies can affect responsiveness
  and thermal/power behavior. Use carefully on production hosts.
- **Singleton:** ``cpuFreq()`` always returns the same instance; use getters
  to re-read per-CPU values.

Development
-----------

Run unit tests on a Linux host with cpufreq available (often requires root for
full coverage)::

    python3 -m unittest tests/test.py -v

Package metadata lives in ``setup.py``; console entry point::

    cpufreq = cpufreq.run:main

Links
-----

- Repository: https://github.com/VitorRamos/cpufreq
- License: MIT — see ``LICENSE.txt``

Authors
-------

- Vitor Ramos
- Alex Furtunato
