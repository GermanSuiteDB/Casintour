/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/https', 'N/runtime'],
    function (search, record, https, runtime) {
        let headers = {
            'User-Agent': 'Suitelet',
            'Connection': 'keep-alive',
            'not-version': 'any',
            'Content-Type': 'application/json'
        }
        const baseURL = 'https://cloud.nominaz.com';
        const urlToken = '/role_manager/oauth2/token';
        const urlEmployees = '/nominaz/server/index.php/nominaz/reportes/ObtenerReporteEmpleados';
        const bodyEmployees = {
            "data": {
                "filtros": {
                    "estado": null
                },
                "conceptosFiltrados": [
                    "documento",
                    "nombre",
                    "apellido",
                    "codigoIess",
                    "genero",
                    "tipoDocumento",
                    "paisResidencia",
                    "paisNacimiento",
                    "provinciaResidencia",
                    "ciudadResidencia",
                    "direccion",
                    "telefonos",
                    "celular",
                    "email",
                    "fechaNacimiento",
                    "estadoCivil",
                    "nombrePareja",
                    "hijos",
                    "numeroHijos",
                    "cargaFamiliarHijo",
                    "asistencia",
                    "fechaIngreso",
                    "fechaSalida",
                    "nivelUno",
                    "nivelDos",
                    "nivelTres",
                    "nivelCuatro",
                    "turno",
                    "cargo",
                    "jefeDirecto"
                ]
            }
        };
        function getInputData() {
            try {
                //get token
                let scriptObj = runtime.getCurrentScript();
                let responseToken = getRefreshToken(scriptObj)
                log.debug('getInputData token', responseToken)
                let token = responseToken?.body ? JSON.parse(responseToken.body)?.response?.accessToken : null;
                if (!token) {
                    log.error('could not generate token', responseToken)
                    return [];
                }
                headers['x-api-key-nominaz'] = token;

                //get employees
                let responseEmployees = postRequest(baseURL + urlEmployees, bodyEmployees);
                log.debug("getInputData responseEmployees", responseEmployees)
                let employees = responseEmployees?.body ? JSON.parse(responseEmployees.body)?.response : null;
                if (!employees || !employees.length) {
                    log.error('could not obtain employee list', responseEmployees)
                    return [];
                }
                return employees;
            } catch (error) {
                log.error({
                    title: 'Error in getInputData function',
                    details: error.message
                })
            }
        }

        function map(context) {
            try {
                var data = JSON.parse(context.value);
                log.debug("map data", data);

                //search for employee
                let employeeDocumentNumber = data.documento;
                let existingId = searchEmployeeId(employeeDocumentNumber);

                let employee;
                // create employee if it does not exist
                if (existingId == -1) {
                    employee = record.create({ type: record.Type.EMPLOYEE, isDynamic: true });
                    setEmployeeAddress(data, employee, true);
                } else {
                    employee = record.load({ type: record.Type.EMPLOYEE, id: existingId, isDynamic: true })
                    setEmployeeAddress(data, employee, false);
                }

                setEmployeeBodyFieldValues(data, employee);


                let employeeId = employee.save({
                    ignoreMandatoryFields: true
                });
                if (existingId == -1) log.audit('employee created', employeeId);
                else log.audit('employee updated', employeeId);

                let supervisorDNI = data.jefeDirecto || "null";
                context.write({
                    key: supervisorDNI,
                    value: employeeId
                });
            } catch (error) {
                log.error({
                    title: 'Error in Map function',
                    details: error
                })
            }
        }

        function reduce(context) {
            try {
                log.debug("reduce context", context)
                let data = context.values
                let supervisorDNI = context.key;
                let supervisorEntityId = searchEmployeeId(supervisorDNI);
                if (supervisorEntityId != -1) {
                    log.debug(`Found Supervisor: ${supervisorDNI}`, `supervisor internal ID: ${supervisorEntityId}`);
                    data.forEach(employeeId => {
                        setSupervisor(supervisorEntityId, employeeId);
                    });
                } else {
                    log.debug(`NOT Found Supervisor: ${supervisorDNI}`, `employees: ${data}`);
                }
            } catch (error) {
                log.error({
                    title: 'Error in Reduce function',
                    details: error
                })
            }
        }

        function postRequest(url, JSONRequestBody) {
            try {
                var response = https.post({
                    body: JSON.stringify(JSONRequestBody),
                    url: url,
                    headers: headers
                });
                return response;
            } catch (error) {
                log.error({
                    title: 'Error in postRequest function',
                    details: error
                });
            }
        }

        function parseDate(dateStr) {
            let parts = dateStr.split("-");
            let day = parts[2];
            let month = parseInt(parts[1], 10) - 1;
            let year = parts[0].length === 2 ? "20" + parts[0] : parts[0];
            return new Date(year, month, day);
        }

        function searchEmployeeIdByName(fullName) {
            try {
                if (!fullName || fullName == "null") return -1
                var employeeId = -1;
                var employeeSearchObj = search.create({
                    type: "employee",
                    filters:
                        [
                            ["entityid", "is", fullName]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "ID interno" })
                        ]
                });
                var searchResultCount = employeeSearchObj.runPaged().count;
                log.debug("employeeSearchObj result count", searchResultCount);
                employeeSearchObj.run().each(function (result) {
                    employeeId = result.getValue({ name: 'internalid' })
                    return false;
                });
                return employeeId;
            } catch (error) {
                log.error("searchEmployeeIdByName error", error);
                return -1
            }
        }

        function searchEmployeeId(employeeDocumentNumber) {
            var employeeFoundInternalId = -1;
            try {
                if (!employeeDocumentNumber) return employeeFoundInternalId;
                var employeeSearchObj = search.create({
                    type: "employee",
                    filters:
                        [
                            ["custentity_sdb_nro_identificador_nominaz", "is", employeeDocumentNumber]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "ID interno" })
                        ]
                });
                employeeSearchObj.run().each(function (result) {
                    log.debug("employee result", result);
                    employeeFoundInternalId = result.getValue({ name: "internalid" });
                    return false;
                });
                return employeeFoundInternalId;
            } catch (error) {
                log.error("searchEmployeeId error", error);
                return employeeFoundInternalId;
            }
        }

        function getAddressSubrecord(employee, createMode) {
            try {
                let addressSubRecord = null;
                if (createMode) {
                    employee.selectNewLine({ sublistId: 'addressbook' });
                    addressSubRecord = employee.getCurrentSublistSubrecord({
                        sublistId: 'addressbook',
                        fieldId: 'addressbookaddress'
                    });
                } else {
                    const addressCount = employee.getLineCount({ sublistId: 'addressbook' });
                    for (let i = 0; i < addressCount; i++) {
                        employee.selectLine({
                            sublistId: 'addressbook',
                            line: i
                        })
                        const addrSubrec = employee.getCurrentSublistSubrecord({
                            sublistId: 'addressbook',
                            fieldId: 'addressbookaddress',
                            line: i
                        });
                        const isNominaz = addrSubrec.getValue({ fieldId: 'custrecord_sdb_is_nominaz_address' });
                        if (isNominaz) {
                            addressSubRecord = addrSubrec;
                            break
                        }
                    }
                }
                return addressSubRecord;
            } catch (error) {
                log.error("getAddressSubrecord error", error);
                return null;
            }
        }

        function fillAddressSubrecord(addressRec, data) {
            try {
                const addr1 = data.direccion.trim();
                const country = data.paisResidencia.trim();
                const city = data.ciudadResidencia.trim();
                const state = data.provinciaResidencia.trim();
                const phone = data.telefono ? data.telefono.trim() : null;

                if (!addr1 || !country || !city) return;

                addressRec.setText({ fieldId: 'country', value: country });
                addressRec.setValue({ fieldId: 'addr1', value: addr1 });
                addressRec.setValue({ fieldId: 'city', value: city });
                addressRec.setValue({ fieldId: 'custrecord_sdb_is_nominaz_address', value: true });
                if (state) addressRec.setValue({ fieldId: 'state', value: state });
                if (phone) addressRec.setValue({ fieldId: 'addrphone', value: phone });
            } catch (error) {
                log.error("fillAddressSubrecord error", error);
            }
        }

        function setEmployeeAddress(data, employee, createMode) {
            try {
                const addressRec = getAddressSubrecord(employee, createMode);
                if (!addressRec) return;
                fillAddressSubrecord(addressRec, data);
                employee.commitLine({ sublistId: 'addressbook' });
            } catch (e) {
                log.error('setEmployeeAddress error', e);
            }
        }


        function setEmployeeBodyFieldValues(data, employee) {
            try {
                let firstName = data.nombre.trim();
                let lastName = data.apellido.trim();
                employee.setValue({ fieldId: 'firstname', value: firstName });
                employee.setValue({ fieldId: 'lastname', value: lastName });

                employee.setValue({
                    fieldId: 'custentity_sdb_nro_identificador_nominaz',
                    value: data.codigo
                })
                employee.setValue({
                    fieldId: 'jobdescription',
                    value: data.cargo.trim()
                })
                employee.setValue({
                    fieldId: 'email',
                    value: data.email.trim()
                })
                employee.setValue({
                    fieldId: 'birthdate',
                    value: parseDate(data.fechaNacimiento.trim())
                })
                employee.setValue({
                    fieldId: 'hiredate',
                    value: parseDate(data.fechaIngreso.trim())
                })
                employee.setValue({
                    fieldId: 'employeestatus',
                    value: 2
                })
                employee.setValue({
                    fieldId: 'defaultexpensereportcurrency',
                    value: 1
                })
                employee.setValue({
                    fieldId: 'custentity_sdb_employee_nominaz',
                    value: true
                });
                let employeePhone = data.celular.trim() || null;
                if (employeePhone) employee.setValue({
                    fieldId: 'mobilephone',
                    value: employeePhone
                })

                let gender = getGender(data.genero.trim());
                employee.setValue({
                    fieldId: 'gender',
                    value: gender
                })
                let phone = getPhone(data.telefonos);
                if (phone) employee.setValue({
                    fieldId: 'phone',
                    value: phone
                })
            } catch (error) {
                log.error("setEmployeeBodyFieldValues error", error);
            }
        }
        function setSupervisor(supervisorId, employeeId) {
            try {
                if (!supervisorId || supervisorId == -1 || !employeeId || employeeId == -1) return
                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        "supervisor": supervisorId
                    },
                    ignoreMandatoryFields: true
                })
            } catch (error) {
                log.error(`setSupervisor supId: ${supervisorId} empId: ${employeeId}`, error);
            }
        }

        function getGender(gender) {
            var notSpecified = 'ns';
            try {
                if (!gender) return notSpecified;
                if (gender === 'Masculino') return 'm';
                if (gender === 'Femenino') return 'f'
                return notSpecified;
            } catch (error) {
                log.error("getGender error", error);
                return notSpecified;
            }
        }

        // function getCivilStatus(employee, civilStatus) {
        //     var returnValue = null;
        //     try {
        //         if (!civilStatus) return returnValue;
        //         let field = employee.getField({
        //             fieldId: 'maritalstatus'
        //         });
        //         let options = field.getSelectOptions({
        //             filter: null
        //         });
        //         for (let i = 0; i < options.length; i++) {
        //             const option = options[i];
        //             if (option.text.trim().toUpperCase() === civilStatus.trim().toUpperCase()) {
        //                 returnValue = option.value;
        //                 break;
        //             }
        //         }
        //         return returnValue;
        //     } catch (error) {
        //         log.error("getCivilStatus error", error);
        //         return returnValue;
        //     }
        // }

        function parseBool(bool) {
            try {
                if (!bool) return false;
                if (bool.toUpperCase() === 'SI') return true;
                return false;
            } catch (error) {
                log.error("parseBool error", error);
                return false;
            }
        }
        function getPhone(phone) {
            try {
                if (!phone) return null;
                return phone.trim();
            } catch (error) {
                log.error("getPhone error", error);
                return null;
            }
        }
        function parseNumber(number) {
            try {
                if (!number) return 0;
                return parseInt(number);
            } catch (error) {
                log.error("parseNumber error", error);
                return 0;
            }
        }
        function getCouplesName(coupleName) {
            var notSpecified = null;
            try {
                if (!coupleName || coupleName === '0') return notSpecified;
                return coupleName.trim();
            } catch (error) {
                log.error("getCouplesName error", error);
                return notSpecified
            }
        }
        function getRefreshToken(scriptObj) {
            try {
                var clientId = scriptObj.getParameter({ name: 'custscript_sdb_client_id_nominaz' });
                var clientSecret = scriptObj.getParameter({ name: 'custscript_sdb_client_secret_nominaz' });
                const bodyToken = {
                    "client_id": clientId,
                    "client_secret": clientSecret,
                    "grant_type": "client_credentials"
                };
                var refreshTokenRespone = postRequest(baseURL + urlToken, bodyToken);
                return refreshTokenRespone;
            } catch (error) {
                log.error("getRefreshToken error", error);
                return null;
            }
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        }
    });
